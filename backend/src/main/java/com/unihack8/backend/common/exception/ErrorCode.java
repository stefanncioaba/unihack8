package com.unihack8.backend.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Every error code the API can return, with its HTTP status and default message.
 * Keep in sync with the error table in docs/API.md — the app switches on these codes.
 */
public enum ErrorCode {

    VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "The request is not valid."),
    INVALID_USERNAME(HttpStatus.BAD_REQUEST, "Usernames are 3-20 letters, digits or underscores."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Sign in to do this."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "You are not allowed to do this."),
    NOT_ORGANIZER(HttpStatus.FORBIDDEN, "Only the event's organiser can do this."),
    BANNED(HttpStatus.FORBIDDEN, "The organiser banned you from this event."),
    EXTERNAL_EVENT(HttpStatus.FORBIDDEN, "Imported events are managed on their own website."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "Not found."),
    TICKET_NOT_FOUND(HttpStatus.NOT_FOUND, "This QR code is not a ticket."),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "This endpoint does not support that HTTP method."),
    USERNAME_TAKEN(HttpStatus.CONFLICT, "This username is already taken."),
    EVENT_FULL(HttpStatus.CONFLICT, "This event has no free spots left."),
    ALREADY_JOINED(HttpStatus.CONFLICT, "You already joined this event."),
    IS_ORGANIZER(HttpStatus.CONFLICT, "Organisers cannot join their own event."),
    EVENT_ENDED(HttpStatus.CONFLICT, "This event is over."),
    NOT_JOINED(HttpStatus.CONFLICT, "You are not in this event."),
    WRONG_EVENT(HttpStatus.CONFLICT, "This ticket belongs to another event."),
    ALREADY_CHECKED_IN(HttpStatus.CONFLICT, "This ticket was already scanned."),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Try again in a minute."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong on our side."),
    AI_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "The assistant is not available right now."),
    SOURCE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "A data source is not available right now.");

    private final HttpStatus status;
    private final String defaultMessage;

    // Binds a code to its HTTP status and fallback message.
    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    // HTTP status sent with this code.
    public HttpStatus status() {
        return status;
    }

    // Message used when the thrower does not give a more specific one.
    public String defaultMessage() {
        return defaultMessage;
    }
}
