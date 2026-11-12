import { describe, expect, test } from "bun:test";
import { redactBody, redactText } from "./redact";

describe("redactText", () => {
  test("masks secret fields quoted as JSON inside free text, keeping the rest", () => {
    expect(
      redactText('Error: refresh failed: {"refreshToken":"KIZT3Hr3KRHS==","userName":"9z5J6xCq3E","code": "872105"}'),
    ).toBe('Error: refresh failed: {"refreshToken":"***","userName":"9z5J6xCq3E","code": "***"}');
  });

  test("masks bearer tokens", () => {
    expect(redactText("Authorization: Bearer abc.def-ghi")).toBe("Authorization: Bearer ***");
  });

  test("masks bare JWTs", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl";
    expect(redactText(`token in body ${jwt} end`)).toBe("token in body *** end");
  });

  test("masks key=value secrets", () => {
    expect(redactText("<p>password=Secret1!&amp;user=qa</p>")).toBe("<p>password=***&amp;user=qa</p>");
  });

  test("masks key: value secrets", () => {
    expect(redactText("<dd>Password: Secret1!</dd>")).toBe("<dd>Password: ***</dd>");
    expect(redactText("verification code: 872105")).toBe("verification code: ***");
  });

  test("masks quoted key=value and key: value secrets", () => {
    expect(redactText('password="Secret1!" user=qa')).toBe("password=*** user=qa");
    expect(redactText("password: 'Secret 1!'")).toBe("password: ***");
    expect(redactText(String.raw`password='Secret\'suffix' user=qa`)).toBe("password=*** user=qa");
  });

  test("masks basic credentials together with their scheme", () => {
    expect(redactText("Authorization: Basic dXNlcjpwYXNz")).toBe("Authorization: ***");
  });

  test("masks a quoted JSON secret that contains an escaped quote", () => {
    expect(redactText(String.raw`{"password":"p\"secretSuffix","user":"qa"}`)).toBe('{"password":"***","user":"qa"}');
  });

  test("keeps error codes and HTTP statuses, which are evidence, not secrets", () => {
    const text = 'Status code: 503, body {"code":"MobileExists","error":"Service Unavailable"}';
    expect(redactText(text)).toBe(text);
  });

  test("leaves text without secrets untouched", () => {
    const error = "Error: BFF should send a code to the number\n\nExpected: 200\nReceived: 503";
    expect(redactText(error)).toBe(error);
  });
});

describe("redactBody", () => {
  test("masks the whole value of a secret field, objects and arrays included", () => {
    expect(redactBody('{"password":{"value":"Secret1!"},"tokens":["a","b"],"user":"qa"}')).toBe(
      '{"password":"***","tokens":"***","user":"qa"}',
    );
  });

  test("masks secrets inside the text of non-secret fields", () => {
    expect(redactBody('{"message":"Authorization: Bearer abc.def"}')).toBe('{"message":"Authorization: Bearer ***"}');
  });

  test("masks an OTP code but keeps a backend error code", () => {
    expect(redactBody('{"mobileNumber":"+520744923451","code":"872105"}')).toBe(
      '{"mobileNumber":"+520744923451","code":"***"}',
    );
    expect(redactBody('{"code":"MobileExists","description":"Mobile exists"}')).toBe(
      '{"code":"MobileExists","description":"Mobile exists"}',
    );
  });

  test("masks a body that is not JSON as text", () => {
    expect(redactBody("<html>password=Secret1!</html>")).toBe("<html>password=***</html>");
  });
});
