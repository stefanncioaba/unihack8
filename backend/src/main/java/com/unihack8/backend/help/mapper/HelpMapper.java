package com.unihack8.backend.help.mapper;

import com.unihack8.backend.help.domain.dto.HelpRequestDetail;
import com.unihack8.backend.help.domain.dto.HelpRequestSummary;
import com.unihack8.backend.help.domain.entity.HelpOfferView;
import com.unihack8.backend.help.domain.entity.HelpRequestView;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Builds the help board API shapes from stored rows. */
public interface HelpMapper {

    // Board / "mine" item; `now` turns an overdue OPEN request into EXPIRED.
    HelpRequestSummary toSummary(HelpRequestView view, Instant now);

    // Detail page for `caller` (may be null), with the offers list.
    HelpRequestDetail toDetail(HelpRequestView view, List<HelpOfferView> offers, UUID caller, Instant now);
}
