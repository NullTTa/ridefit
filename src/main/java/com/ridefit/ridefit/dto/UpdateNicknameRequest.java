package com.ridefit.ridefit.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateNicknameRequest(@NotBlank String name) {
}
