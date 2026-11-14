package com.unihack8.backend.help.domain.dto;

import java.util.UUID;

/** Answer to DELETE /help-requests/{id}/offers/me. */
public record WithdrawResponse(UUID requestId, String status) {
}
