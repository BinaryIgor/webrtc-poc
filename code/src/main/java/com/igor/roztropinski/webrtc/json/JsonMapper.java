package com.igor.roztropinski.webrtc.json;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.deser.impl.CreatorCandidate;
import com.fasterxml.jackson.module.paramnames.ParameterNamesModule;

import java.util.List;

public class JsonMapper {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    static {
        MAPPER.disable(SerializationFeature.FAIL_ON_EMPTY_BEANS);
        MAPPER.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

        MAPPER.setVisibility(PropertyAccessor.FIELD, JsonAutoDetect.Visibility.ANY);
        MAPPER.setVisibility(PropertyAccessor.CREATOR, JsonAutoDetect.Visibility.ANY);
        MAPPER.setVisibility(PropertyAccessor.GETTER, JsonAutoDetect.Visibility.NONE);
        MAPPER.setVisibility(PropertyAccessor.IS_GETTER, JsonAutoDetect.Visibility.NONE);

        MAPPER.registerModule(new SocketMessageModule());
        //For all args constructor to work with jackson
        MAPPER.registerModule(new ParameterNamesModule(JsonCreator.Mode.PROPERTIES));
    }

    public static String json(Object value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public static <T> T object(String json, Class<T> clazz) {
        try {
            return MAPPER.readValue(json, clazz);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public static <T> List<T> objects(String json, Class<T> clazz) {
        try {
            var type = MAPPER.getTypeFactory().constructCollectionType(List.class, clazz);
            return MAPPER.readValue(json, type);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
