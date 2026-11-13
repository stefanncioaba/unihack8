package com.unihack8.backend.common.security;

import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.exception.ErrorResponseFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** Answers 401 with the standard error JSON when the token is missing, expired or invalid. */
@Component
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ErrorResponseFactory errors;
    private final ObjectMapper objectMapper;

    // Needs the shared error factory and Spring's JSON mapper.
    public JsonAuthenticationEntryPoint(ErrorResponseFactory errors, ObjectMapper objectMapper) {
        this.errors = errors;
        this.objectMapper = objectMapper;
    }

    // Writes the UNAUTHORIZED error; the WWW-Authenticate header tells clients a bearer token is expected.
    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        response.setStatus(ErrorCode.UNAUTHORIZED.status().value());
        response.setHeader("WWW-Authenticate", "Bearer");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getOutputStream(),
                errors.create(ErrorCode.UNAUTHORIZED, null, request.getRequestURI()));
    }
}
