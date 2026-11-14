package com.unihack8.backend.help.domain.dto;

import java.util.List;

/** GET /help-requests/mine: requests the caller posted and requests they offered on. */
public record MyHelpResponse(List<HelpRequestSummary> requested, List<HelpRequestSummary> offered) {
}
