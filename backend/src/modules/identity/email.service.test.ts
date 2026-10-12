import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendVerificationEmail, isEmailConfigured, getMissingEmailConfig } from "./email.service.js";
import { env } from "../../config/env.js";

describe("EmailJS Email Delivery Service", () => {
  const originalEnv = { ...env };

  beforeEach(() => {
    vi.restoreAllMocks();
    // Default valid mock credentials for tests
    env.EMAILJS_SERVICE_ID = "srv_test_123";
    env.EMAILJS_TEMPLATE_ID = "tmpl_test_456";
    env.EMAILJS_PUBLIC_KEY = "pub_key_789";
    env.EMAILJS_PRIVATE_KEY = "priv_key_abc";
    env.NODE_ENV = "test";
  });

  afterEach(() => {
    Object.assign(env, originalEnv);
  });

  describe("Configuration checks", () => {
    it("reports configured when all 4 variables are present", () => {
      expect(isEmailConfigured()).toBe(true);
      expect(getMissingEmailConfig()).toHaveLength(0);
    });

    it("identifies missing environment variables", () => {
      env.EMAILJS_SERVICE_ID = "";
      env.EMAILJS_PRIVATE_KEY = "   ";
      expect(isEmailConfigured()).toBe(false);
      expect(getMissingEmailConfig()).toEqual(["EMAILJS_SERVICE_ID", "EMAILJS_PRIVATE_KEY"]);
    });

    it("throws error and does not dispatch when configuration is missing in dev/test", async () => {
      env.EMAILJS_SERVICE_ID = "";
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      await expect(
        sendVerificationEmail({
          to: "user@example.com",
          name: "Test User",
          code: "123456",
        }),
      ).rejects.toThrow(/EmailJS is not configured.*EMAILJS_SERVICE_ID/);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("throws production error when configuration is missing in production", async () => {
      env.NODE_ENV = "production";
      env.EMAILJS_PUBLIC_KEY = "";
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      await expect(
        sendVerificationEmail({
          to: "user@example.com",
          name: "Test User",
          code: "123456",
        }),
      ).rejects.toThrow("Transactional email delivery is not configured in production.");

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("API Request Dispatching", () => {
    it("successfully sends an OTP email via EmailJS REST API with all required fields", async () => {
      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("OK", { status: 200, statusText: "OK" }),
      );

      await sendVerificationEmail({
        to: "sarah.ops@example.com",
        name: "Sarah Okonkwo",
        code: "948201",
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];

      expect(url).toBe("https://api.emailjs.com/api/v1.0/email/send");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual(
        expect.objectContaining({
          "Content-Type": "application/json",
        }),
      );

      const parsedBody = JSON.parse(init?.body as string);
      expect(parsedBody).toEqual({
        service_id: "srv_test_123",
        template_id: "tmpl_test_456",
        user_id: "pub_key_789",
        accessToken: "priv_key_abc",
        template_params: {
          to_email: "sarah.ops@example.com",
          email: "sarah.ops@example.com",
          to_name: "Sarah Okonkwo",
          name: "Sarah Okonkwo",
          passcode: "948201",
          otp_code: "948201",
          code: "948201",
          expires_in_minutes: 10,
          app_name: "OpsNinja",
        },
      });
    });

    it("handles EmailJS provider rejection (HTTP 400 Bad Request)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("The template_id is invalid", {
          status: 400,
          statusText: "Bad Request",
        }),
      );

      await expect(
        sendVerificationEmail({
          to: "user@example.com",
          name: "User",
          code: "123456",
        }),
      ).rejects.toThrow("Failed to send verification email. Please try again.");
    });

    it("handles EmailJS authorization rejection (HTTP 401/403)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Invalid access token", {
          status: 403,
          statusText: "Forbidden",
        }),
      );

      await expect(
        sendVerificationEmail({
          to: "user@example.com",
          name: "User",
          code: "123456",
        }),
      ).rejects.toThrow("Failed to send verification email. Please try again.");
    });

    it("handles network failure gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new TypeError("getaddrinfo ENOTFOUND api.emailjs.com"),
      );

      await expect(
        sendVerificationEmail({
          to: "user@example.com",
          name: "User",
          code: "123456",
        }),
      ).rejects.toThrow("Failed to deliver verification email. Please try again.");
    });

    it("handles request timeout gracefully", async () => {
      const timeoutError = new Error("The operation was aborted due to timeout");
      timeoutError.name = "TimeoutError";

      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(timeoutError);

      await expect(
        sendVerificationEmail({
          to: "user@example.com",
          name: "User",
          code: "123456",
        }),
      ).rejects.toThrow("Verification email service timed out. Please try again.");
    });
  });
});
