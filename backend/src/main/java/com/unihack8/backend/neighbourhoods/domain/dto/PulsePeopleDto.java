package com.unihack8.backend.neighbourhoods.domain.dto;

/**
 * Community members going out in the area (joined or checked in to an event now or tonight).
 *
 * @param going         different people going
 * @param reliableGoing of those, people with a reliability score of at least 100 (the starting score)
 */
public record PulsePeopleDto(int going, int reliableGoing) {
}
