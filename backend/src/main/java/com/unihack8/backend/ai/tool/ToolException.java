package com.unihack8.backend.ai.tool;

/** A tool could not run with the given arguments; the message is shown to the model so it can retry. */
public class ToolException extends RuntimeException {

    // Error with a message for the model.
    public ToolException(String message) {
        super(message);
    }
}
