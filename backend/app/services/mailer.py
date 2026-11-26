"""Minimal SMTP client shared by the digest and the ops alert.

Sending is disabled when ``smtp_host`` is empty: callers log a clear status
instead of touching the network, so local runs and tests stay quiet.
"""

from __future__ import annotations

import smtplib
from email.message import EmailMessage
from email.utils import formatdate

from ..config import Settings


class MailError(RuntimeError):
    """Raised when the SMTP transaction itself fails."""


def mail_configured(settings: Settings) -> bool:
    return bool(settings.smtp_host)


def _send(settings: Settings, messages: list[EmailMessage]) -> int:
    """Open one connection and deliver every message. Returns the count sent."""
    if not settings.smtp_host:
        return 0
    try:
        if settings.smtp_port == 465:
            client = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30)
        else:
            client = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30)
    except (OSError, smtplib.SMTPException) as exc:
        raise MailError(f"could not connect to {settings.smtp_host}:{settings.smtp_port}: {exc}") from exc
    sent = 0
    try:
        with client:
            client.login(settings.smtp_user, settings.smtp_password)
            for message in messages:
                client.send_message(message)
                sent += 1
    except smtplib.SMTPException as exc:
        raise MailError(f"SMTP delivery failed: {exc}") from exc
    return sent


def build_message(
    settings: Settings, to: str, subject: str, text: str, html: str | None = None
) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from or settings.smtp_user
    message["To"] = to
    message["Date"] = formatdate(localtime=False)
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")
    return message


def send_mail(settings: Settings, to: str, subject: str, text: str, html: str | None = None) -> int:
    return _send(settings, [build_message(settings, to, subject, text, html)])
