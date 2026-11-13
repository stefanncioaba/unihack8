package com.unihack8.backend.users.domain.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record UpdateUsernameRequest(
        @NotNull
        @Pattern(regexp = "[A-Za-z0-9_]{3,20}", message = "Username must be 3-20 letters, digits, or underscores")
        String username) {
}
