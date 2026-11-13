package com.unihack8.backend.users.controller;

import com.unihack8.backend.common.ApiError;
import com.unihack8.backend.users.service.InvalidSearchException;
import com.unihack8.backend.users.service.UserNotFoundException;
import com.unihack8.backend.users.service.UsernameTakenException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = UserController.class)
public class UserExceptionHandler {

    // Reports a requested profile that does not exist.
    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ApiError> notFound(UserNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("USER_NOT_FOUND", exception.getMessage()));
    }

    // Reports a username already owned by another profile.
    @ExceptionHandler(UsernameTakenException.class)
    public ResponseEntity<ApiError> usernameTaken(UsernameTakenException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError("USERNAME_TAKEN", exception.getMessage()));
    }

    // Reports an empty or missing search query.
    @ExceptionHandler({InvalidSearchException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<ApiError> invalidSearch(Exception exception) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_INPUT", "Search query must contain at least one character"));
    }

    // Reports malformed JSON, IDs, and invalid usernames with one stable shape.
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> invalidInput(Exception exception) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_INPUT", "Invalid user request"));
    }
}
