package com.unihack8.backend.ai.tool;

import com.unihack8.backend.ai.domain.ToolContext;
import java.util.Map;

/**
 * A function the model may call (PLAN 11.2). Every Spring bean implementing this is offered to
 * Gemini automatically.
 */
public interface AiTool {

    // Function name the model uses, e.g. "search_places".
    String name();

    // Gemini functionDeclaration: name, description and JSON-schema parameters.
    Map<String, Object> declaration();

    // Runs the tool; the result goes back to the model as JSON. Throw ToolException for bad arguments.
    Map<String, Object> execute(Map<String, Object> args, ToolContext context);
}
