/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { IComponentHTMLVisual } from "@microsoft/fluid-component-core-interfaces";
import { IContainerContext } from "@microsoft/fluid-container-definitions";
import { renderChat } from "./chat";
// eslint-disable-next-line import/no-internal-modules
import { Runtime } from "./runtime/runtime";

export class ChatRunner implements IComponentHTMLVisual {

    public get IComponentHTMLVisual() { return this; }

    constructor(private readonly runtime: Runtime) {
    }

    public render(elm: HTMLElement) {
        renderChat(this.runtime, elm);
    }
}

export async function instantiateRuntime(context: IContainerContext): Promise<Runtime> {
    const runtime = await Runtime.load(context);

    runtime.registerRequestHandler(
        async (request) => ({ status: 200, mimeType: "fluid/component", value: new ChatRunner(runtime) }),
    );

    return runtime;
}