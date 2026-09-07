import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Recipient } from "@relay/platform";

/**
 * How a report leaves Leodis.
 *
 * Two implementations behind one interface, the same shape as identity: the
 * real one, and a local one that makes the gap visible rather than pretending
 * the feature is absent.
 *
 * Microsoft Graph is the real transport, so a sent report comes from a Leodis
 * mailbox and appears in that mailbox's sent items — which is where somebody
 * will look when a client says they never received it. It needs a Mail.Send
 * permission that the app registration does not yet have; that is a separate
 * consent and a separate decision (ADR-07).
 *
 * Until then, the local transport writes a real .eml file. Not a log line: an
 * actual message with the PDF attached, which can be opened in Outlook and
 * looked at. Reviewing what would have gone out is worth far more than a line
 * saying something would have been sent.
 */

export interface Outgoing {
  readonly to: Recipient;
  readonly subject: string;
  readonly body: string;
  readonly attachment: { readonly fileName: string; readonly bytes: Uint8Array };
}

export interface Transport {
  readonly kind: "graph" | "outbox";
  send(message: Outgoing): Promise<void>;
  /** Where a local message landed, so the interface can point at it. */
  lastLocation?: string;
}

const OUTBOX = join(process.cwd(), ".relay-prototype", "outbox");

/** RFC 2047 encoding, so a name with an accent or an ampersand survives. */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function chunk(base64: string): string {
  return base64.replace(/(.{76})/g, "$1\r\n");
}

export function outboxTransport(): Transport {
  const transport: Transport = {
    kind: "outbox",
    async send(message) {
      mkdirSync(OUTBOX, { recursive: true });

      const boundary = `relay-${Math.random().toString(36).slice(2)}`;
      const eml = [
        `From: Leodis Relay <relay@leodis.invalid>`,
        `To: ${encodeHeader(message.to.name)} <${message.to.address}>`,
        `Subject: ${encodeHeader(message.subject)}`,
        `Date: ${new Date().toUTCString()}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        message.body,
        "",
        `--${boundary}`,
        `Content-Type: application/pdf; name="${message.attachment.fileName}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${message.attachment.fileName}"`,
        "",
        chunk(Buffer.from(message.attachment.bytes).toString("base64")),
        "",
        `--${boundary}--`,
        "",
      ].join("\r\n");

      const path = join(
        OUTBOX,
        `${new Date().toISOString().replace(/[:.]/g, "-")}-${message.to.address}.eml`,
      );
      writeFileSync(path, eml, "utf8");
      transport.lastLocation = path;
    },
  };
  return transport;
}

/**
 * Microsoft Graph sendMail.
 *
 * Written against the shape Graph expects so that turning it on is a matter of
 * granting a permission and supplying a token, not of writing this. It is not
 * reachable until both exist, and says which is missing rather than failing
 * obscurely at send time.
 */
export function graphTransport(getToken: () => Promise<string>): Transport {
  return {
    kind: "graph",
    async send(message) {
      const token = await getToken();
      const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: message.subject,
            body: { contentType: "Text", content: message.body },
            toRecipients: [
              { emailAddress: { address: message.to.address, name: message.to.name } },
            ],
            attachments: [
              {
                "@odata.type": "#microsoft.graph.fileAttachment",
                name: message.attachment.fileName,
                contentType: "application/pdf",
                contentBytes: Buffer.from(message.attachment.bytes).toString("base64"),
              },
            ],
          },
          // Kept, so there is a record in the sender's mailbox of what went out.
          saveToSentItems: true,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Microsoft rejected the message (${response.status}). ${detail.slice(0, 200)}`);
      }
    },
  };
}

export interface TransportStatus {
  transport: Transport;
  /** Why the real transport is unavailable, if it is. */
  missing: string[];
}

export function resolveTransport(): TransportStatus {
  // Mail.Send is a separate consent from sign-in and has not been granted.
  const enabled = process.env.RELAY_MAIL_ENABLED === "yes";
  if (!enabled) {
    return {
      transport: outboxTransport(),
      missing: ["RELAY_MAIL_ENABLED", "Graph Mail.Send permission"],
    };
  }
  return {
    transport: graphTransport(async () => {
      throw new Error(
        "Sending through Microsoft needs a Graph access token. Grant Mail.Send on the app " +
          "registration and wire token acquisition before enabling this.",
      );
    }),
    missing: [],
  };
}
