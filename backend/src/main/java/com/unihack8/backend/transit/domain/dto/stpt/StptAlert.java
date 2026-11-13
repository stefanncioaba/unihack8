package com.unihack8.backend.transit.domain.dto.stpt;

/** One service alert from /proxy-alerts.php. */
public record StptAlert(String id, String headerText, String descriptionText) {
}
