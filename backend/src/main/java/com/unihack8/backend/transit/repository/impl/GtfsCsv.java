package com.unihack8.backend.transit.repository.impl;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/** Minimal CSV reader for GTFS files: header row, comma separated, "quoted" fields with "" escapes. */
final class GtfsCsv {

    // Utility class.
    private GtfsCsv() {
    }

    // Calls rowHandler once per data row with a column-name -> value map.
    static void read(BufferedReader reader, Consumer<Map<String, String>> rowHandler) throws IOException {
        String headerLine = reader.readLine();
        if (headerLine == null) {
            return;
        }
        // Strip the UTF-8 byte-order mark some exporters add.
        if (!headerLine.isEmpty() && headerLine.charAt(0) == '﻿') {
            headerLine = headerLine.substring(1);
        }
        List<String> header = split(headerLine);
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.isBlank()) {
                continue;
            }
            List<String> values = split(line);
            Map<String, String> row = new HashMap<>(header.size() * 2);
            for (int i = 0; i < header.size(); i++) {
                row.put(header.get(i).trim(), i < values.size() ? values.get(i) : "");
            }
            rowHandler.accept(row);
        }
    }

    // Splits one CSV line, honouring quotes.
    static List<String> split(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (quoted) {
                if (c == '"' && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else if (c == '"') {
                    quoted = false;
                } else {
                    current.append(c);
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == ',') {
                fields.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        fields.add(current.toString());
        return fields;
    }

    // "HH:MM:SS" (hours may exceed 23) -> seconds after midnight; -1 when empty or unreadable.
    static int seconds(String time) {
        if (time == null || time.isBlank()) {
            return -1;
        }
        String[] p = time.trim().split(":");
        if (p.length != 3) {
            return -1;
        }
        try {
            return Integer.parseInt(p[0]) * 3600 + Integer.parseInt(p[1]) * 60 + Integer.parseInt(p[2]);
        } catch (NumberFormatException e) {
            return -1;
        }
    }
}
