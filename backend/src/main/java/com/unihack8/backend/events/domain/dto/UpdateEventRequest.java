package com.unihack8.backend.events.domain.dto;

import java.util.Map;

/** Partial update retaining the difference between omitted and explicit null fields. */
public record UpdateEventRequest(Map<String, Object> fields) {
    // Reports whether the client included a field, even when its value is null.
    public boolean has(String field) {
        return fields.containsKey(field);
    }

    // Returns the submitted value for a field.
    public Object value(String field) {
        return fields.get(field);
    }
}
