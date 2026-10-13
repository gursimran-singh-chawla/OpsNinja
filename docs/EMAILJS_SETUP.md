# EmailJS Setup Guide for OpsNinja OTP Verification

This guide walks you through setting up transactional email delivery for OpsNinja using EmailJS with a personal or business Gmail account. No custom domain is required.

---

## 1. Create an EmailJS Account

1. Go to [https://www.emailjs.com](https://www.emailjs.com) and click **Sign Up Free**.
2. Complete registration and verify your email address.
3. Log in to your EmailJS dashboard.

---

## 2. Connect Your Gmail Account as an Email Service

1. In the EmailJS dashboard, click on **Email Services** in the left sidebar.
2. Click **Add New Service**.
3. Select **Gmail** from the list of personal email providers.
4. Give your service a recognizable name (e.g., `OpsNinja Gmail Service`).
5. Note the generated **Service ID** (e.g., `service_xxxxxxx`).
6. Click **Connect Account** and authenticate with your Google/Gmail account. Grant EmailJS permission to send emails on your behalf.
7. Click **Create Service**.

---

## 3. Create an OTP Email Template

1. In the EmailJS dashboard, navigate to **Email Templates** in the left navigation.
2. Click **Create New Template**.
3. Set the template name to `OpsNinja OTP Verification`.
4. Note the generated **Template ID** (e.g., `template_xxxxxxx`).

---

## 4. Configure Recipient & Sender Settings

Under the **Settings** tab on the template editor:
1. **To Email**: Set to `{{to_email}}` (or `{{email}}`).
   > This instructs EmailJS to dynamically send the email to the address supplied by the OpsNinja backend.
2. **From Name**: Set to `OpsNinja Operations` or `{{app_name}}`.
3. **Subject**: Set to `Your OpsNinja verification code: {{passcode}}` (or `Verify your OpsNinja account`).

---

## 5. Configure Dynamic Template Variables

OpsNinja's backend automatically passes the following dynamic template variables to EmailJS in `template_params`:

| Template Variable | Type | Description | Example Value |
|---|---|---|---|
| `{{to_email}}` | string | Target recipient's email address | `user@example.com` |
| `{{email}}` | string | Alias for recipient's email | `user@example.com` |
| `{{to_name}}` | string | Registered user's display name | `Sarah Okonkwo` |
| `{{name}}` | string | Alias for display name | `Sarah Okonkwo` |
| `{{passcode}}` | string | The 6-digit numeric OTP code | `849201` |
| `{{otp_code}}` | string | Alias for the 6-digit OTP code | `849201` |
| `{{code}}` | string | Alias for the 6-digit OTP code | `849201` |
| `{{expires_in_minutes}}` | number | OTP validity duration in minutes | `10` |
| `{{app_name}}` | string | Application brand name | `OpsNinja` |

### Recommended Email Template Body

Paste the following into your EmailJS template content editor:

```html
Hello {{to_name}},

Your OpsNinja verification code is:

  {{passcode}}

This 6-digit code will expire in {{expires_in_minutes}} minutes. Enter this code on the verification screen to activate your account.

If you did not request this code, you can safely ignore this email.

— The {{app_name}} Team
```

Click **Save** in the top-right corner to save your template.

---

## 6. Find Your API Keys (Public Key & Private Key)

1. In the EmailJS sidebar, click on **Account** (or the profile icon at the bottom left).
2. Under the **API Keys** tab, you will find:
   - **Public Key**: Look under *Public Key* (e.g., `user_xxxxxxx` or alphanumeric string).
   - **Private Key**: Look under *Private Key* / *Access Token*. Click **Generate** if one has not yet been created, and copy the value.
     > ⚠️ **Security Warning**: The Private Key allows backend REST API requests with full sending authority. Never share it or place it in client-side code.
3. Under the **Security** tab:
   - Ensure **"Allow EmailJS API requests from non-browser applications"** is enabled so server-to-server requests from Node.js / Express are permitted.

---

## 7. Add Environment Variables to Your Backend

Open your local `backend/.env` file (or root `.env`) and add your four values:

```env
EMAILJS_SERVICE_ID="your_service_id"
EMAILJS_TEMPLATE_ID="your_template_id"
EMAILJS_PUBLIC_KEY="your_public_key"
EMAILJS_PRIVATE_KEY="your_private_key"
```

> **Note**: Do not use `VITE_` prefixes. These credentials belong strictly to the backend Express server.

---

## 8. Test the Flow Locally

1. Restart your backend server:
   ```bash
   npm run dev:backend
   ```
2. Open the OpsNinja web interface at `http://localhost:5173/signup`.
3. Fill in the signup form with a test email address that you have access to.
4. Submit the registration form.
5. Check your inbox for the EmailJS OTP message.
6. Enter the 6-digit code on the `/verify-email` screen.
7. Confirm that your email verification succeeds. In accordance with the mandatory Admin Approval Gate, your account will display the **"Account Pending Approval"** screen. An administrator must approve your account on the Admin Platform (`/admin`) before login is permitted.
8. Test failure paths:
   - Entering an incorrect code displays an error and tracks attempts (up to 5).
   - Clicking "Resend code" respects the 60-second cooldown timer.

---

## 9. Troubleshooting & Diagnostics

If an email does not arrive:
1. **Check Backend Terminal Logs**:
   - The backend logs diagnostic events such as `emailjs_api_error`, `emailjs_configuration_missing`, or `emailjs_timeout`.
   - Sensitive data (like the OTP code or private key) is never logged.
2. **Check EmailJS Dashboard History**:
   - In EmailJS, go to **History** in the sidebar.
   - Review recent delivery events. If a send failed, EmailJS will show the exact provider error (e.g. Gmail rate limit, invalid template ID, or authentication failure).
3. **Gmail Restrictions**:
   - Standard free Gmail accounts have a sending limit of approximately 500 emails/day.
   - If Gmail disconnects, re-authorize the service under **Email Services** > **Edit** > **Reconnect**.

---

## 10. Production Deployment on Render

When deploying the backend on [Render.com](https://render.com):
1. Navigate to your **OpsNinja Web Service** in the Render Dashboard.
2. Go to **Environment** in the left menu.
3. Add the four environment variables:
   - `EMAILJS_SERVICE_ID`
   - `EMAILJS_TEMPLATE_ID`
   - `EMAILJS_PUBLIC_KEY`
   - `EMAILJS_PRIVATE_KEY`
4. Click **Save Changes**. Render will automatically trigger a zero-downtime redeployment with the new environment variables active.
5. The frontend on Vercel requires **no** EmailJS configuration; it continues communicating solely with your Render backend.
