package com.unihack8.backend.common.security;

import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.exception.ErrorResponseFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** Answers 403 with the standard error JSON when a signed-in user may not do something. */
@Component
public class JsonAccessDeniedHandler implements AccessDeniedHandler {

    private final ErrorResponseFactory errors;
    private final ObjectMapper objectMapper;

    // Needs the shared error factory and Spring's JSON mapper.
    public JsonAccessDeniedHandler(ErrorResponseFactory errors, ObjectMapper objectMapper) {
        this.errors = errors;
        this.objectMapper = objectMapper;
    }

    // Writes the FORBIDDEN error.
    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        response.setStatus(ErrorCode.FORBIDDEN.status().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getOutputStream(),
                errors.create(ErrorCode.FORBIDDEN, null, request.getRequestURI()));
    }
}
