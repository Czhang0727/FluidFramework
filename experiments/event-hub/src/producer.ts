import * as assert from "assert";
import * as Kafka from "node-rdkafka";
import { Deferred } from "./deferred";

// wn0-prague.51zzxugph01enkxyhuw204h0if.xx.internal.cloudapp.net

const producer = new Kafka.Producer({
    // 'debug' : 'all',
    "dr_cb": true,  // delivery report callback
    "metadata.broker.list": "kafka:9092", // "prague-eu.servicebus.windows.net:9093"
    // "sasl.mechanisms": "PLAIN",
    // tslint:disable-next-line:max-line-length
    // "sasl.password": "Endpoint=sb://prague-eu.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=u5rC/uCLRQapndUk9+ixNVNfoanpNbtAL8LJYS15DPc=",
    // "sasl.username": "$ConnectionString",
    // "security.protocol": "SASL_SSL",
}, null);
producer.setPollInterval(1);

const topicName = "test2";
const partition = 0;

// logging debug messages, if debug is enabled
producer.on("event.log", (log) => {
    console.log(log);
});

// logging all errors
producer.on("event.error", (err) => {
    console.error("Error from producer");
    console.error(err);
});

// Wait for the ready event before producing
producer.on("ready", (arg) => {
    console.log("producer ready." + JSON.stringify(arg));
});

producer.on("disconnected", (arg) => {
    console.log("producer disconnected. " + JSON.stringify(arg));
});

// starting the producer
producer.connect(null, (error, data) => {
    console.log(`Connected`, error, data);

    runWriteTest(process.argv[2]);
});

async function sendBatch(from: number, to: number, suffix: string): Promise<void> {
    for (; from < to; from++) {
        const message = `${Date.now().toString()}: ${suffix}`;
        const value = new Buffer(message);
        const key = `test`;

        try {
            producer.produce(topicName, partition, value, key);
        } catch (error) {
            if (Kafka.CODES.ERRORS.ERR__QUEUE_FULL === error.code) {
                console.log(`Outbound full - waiting to send`);
                return new Promise<void>((resolve, reject) => {
                    setTimeout(
                        () => {
                            sendBatch(from, to, suffix).then(
                                () => resolve(),
                                (error) => reject(error));
                        },
                        250);
                });
            }
        }
    }
}

function sendBatches(currentBatch, totalBatches, messagesPerBatch, resolve, reject, suffix: string) {
    if (currentBatch === totalBatches) {
        resolve();
        return;
    }

    const from = currentBatch * messagesPerBatch;
    const to = from + messagesPerBatch;

    console.log(`Sending ${from} to ${to} of ${totalBatches * messagesPerBatch}`);
    sendBatch(from, to, suffix).then(
        () => {
            setTimeout(
                () => {
                    sendBatches(currentBatch + 1, totalBatches, messagesPerBatch, resolve, reject, suffix);
                },
                2000);
        },
        (error) => {
            reject(error);
        });
}

async function runWriteTest(suffix: string) {
    const start = Date.now();

    const totalMessages =       50;
    const messagesPerBatch =    10;
    const totalBatches = totalMessages / messagesPerBatch;
    assert.equal(totalBatches * messagesPerBatch, totalMessages, "total messages should be divisible by batch size");

    const done = new Deferred<void>();

    let counter = 0;
    producer.on("delivery-report", (err, report) => {
        if (err) {
            console.error(err);
        }
        counter++;
        if (counter === totalMessages) {
            done.resolve();
        }

        // if (counter % messagesPerBatch === 0) {
        //   console.log(`Batch ${counter / messagesPerBatch} complete`);
        //   console.log(`Send count === ${sendCount}`);
        // }
    });

    await new Promise((resolve, reject) => {
        setTimeout(
            () => {
                console.log("Beginning send");
                sendBatches(0, totalBatches, messagesPerBatch, resolve, reject, suffix);
            },
            5000);
    });

    await done.promise;

    const end = Date.now();
    const total = end - start;
    console.log("Complete");
    console.log(`${totalMessages} messages in ${total} ms`);
    console.log(`${(totalMessages * 1000 / total).toFixed(4)} msg/s`);

    producer.disconnect();
}
