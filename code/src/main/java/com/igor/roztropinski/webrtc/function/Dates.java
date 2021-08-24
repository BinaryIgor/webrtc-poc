package com.igor.roztropinski.webrtc.function;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class Dates {

    public static Clock clock() {
        return Clock.systemUTC();
    }

    public static LocalDateTime now() {
        return LocalDateTime.now(clock());
    }

    public static LocalDate nowDate() {
        return LocalDate.now(clock());
    }
}
