package com.unihack8.backend.help.mapper.impl;

import com.unihack8.backend.events.domain.dto.UserSummary;
import com.unihack8.backend.help.domain.HelpRules;
import com.unihack8.backend.help.domain.dto.HelpOfferResponse;
import com.unihack8.backend.help.domain.dto.HelpRequestDetail;
import com.unihack8.backend.help.domain.dto.HelpRequestSummary;
import com.unihack8.backend.help.domain.entity.HelpOfferView;
import com.unihack8.backend.help.domain.entity.HelpRequest;
import com.unihack8.backend.help.domain.entity.HelpRequestView;
import com.unihack8.backend.help.mapper.HelpMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Hand-written HelpMapper. */
@Component
public class HelpMapperImpl implements HelpMapper {

    // Copies the request fields and computes the visible status.
    @Override
    public HelpRequestSummary toSummary(HelpRequestView view, Instant now) {
        HelpRequest r = view.request();
        return new HelpRequestSummary(r.id(), r.title(), r.category(), r.address(), r.lat(), r.lon(), requester(view),
                HelpRules.effectiveStatus(r.status(), r.expiresAt(), now), r.createdAt(), r.expiresAt(),
                view.offerCount(), view.myOffer());
    }

    // Adds the description, the helper (the HELPED offer), the offers and the caller's options.
    @Override
    public HelpRequestDetail toDetail(HelpRequestView view, List<HelpOfferView> offers, UUID caller, Instant now) {
        HelpRequest r = view.request();
        boolean isRequester = caller != null && caller.equals(r.requesterId());
        boolean hasCurrentOffer = HelpRules.OFFERED.equals(view.myOffer()) || HelpRules.HELPED.equals(view.myOffer());
        boolean canOffer = caller != null && !isRequester && !hasCurrentOffer
                && HelpRules.isOpen(r.status(), r.expiresAt(), now);
        UserSummary helper = offers.stream().filter(o -> HelpRules.HELPED.equals(o.offer().status()))
                .map(HelpMapperImpl::user).findFirst().orElse(null);
        List<HelpOfferResponse> items = offers.stream()
                .map(o -> new HelpOfferResponse(user(o), o.offer().status(), o.offer().offeredAt())).toList();
        return new HelpRequestDetail(r.id(), r.title(), r.description(), r.category(), r.address(), r.lat(), r.lon(),
                requester(view), HelpRules.effectiveStatus(r.status(), r.expiresAt(), now), r.createdAt(),
                r.expiresAt(), r.closedAt(), view.offerCount(), view.myOffer(), helper, items, isRequester, canOffer);
    }

    // The requester's public identity.
    private static UserSummary requester(HelpRequestView view) {
        return new UserSummary(view.request().requesterId(), view.requesterUsername(), view.requesterScore());
    }

    // A helper's public identity.
    private static UserSummary user(HelpOfferView o) {
        return new UserSummary(o.offer().helperId(), o.username(), o.reliabilityScore());
    }
}
