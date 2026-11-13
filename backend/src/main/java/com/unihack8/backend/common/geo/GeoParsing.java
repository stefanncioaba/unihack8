package com.unihack8.backend.common.geo;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;

/** Shared parsing of comma-separated coordinate parameters. */
final class GeoParsing {

    // Utility class.
    private GeoParsing() {
    }

    // Splits "a,b,..." into exactly `count` finite numbers, or answers 400 with the expected format.
    static double[] numbers(String value, int count, String parameterName, String format) {
        String problem = parameterName + " must be " + format + ".";
        if (value == null || value.isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, problem);
        }
        String[] parts = value.split(",");
        if (parts.length != count) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, problem);
        }
        double[] numbers = new double[count];
        for (int i = 0; i < count; i++) {
            try {
                numbers[i] = Double.parseDouble(parts[i].trim());
            } catch (NumberFormatException e) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, problem);
            }
            if (!Double.isFinite(numbers[i])) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, problem);
            }
        }
        return numbers;
    }
}
