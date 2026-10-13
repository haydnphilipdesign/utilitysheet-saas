-- Handoff evidence: what happened to the completion and invitation emails, and
-- how each sheet PDF render went.
--
-- Additive and idempotent. Nothing reads these tables until this is applied;
-- writers are best-effort and readers report "not installed" in the meantime.
--
-- No email address, name, property address, link, filename or document
-- content is stored. Recipients are positions within one send (slot 0, 1, ...).
-- The provider message ID is the only value that ties a row to a message, and
-- it is used solely to match signed delivery callbacks.

CREATE TABLE IF NOT EXISTS notification_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- One per handoff attempt; shared by every recipient slot of that attempt
    -- and by the PDF renders made for it.
    operation_id UUID NOT NULL,
    -- Evidence has no meaning without its request; removing it removes these rows.
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('completion_notification', 'request_invitation')),
    mode TEXT NOT NULL CHECK (mode IN ('live', 'test')),
    recipient_slot SMALLINT NOT NULL CHECK (recipient_slot BETWEEN 0 AND 99),
    intended_recipients SMALLINT NOT NULL CHECK (intended_recipients BETWEEN 0 AND 100),
    -- accepted: the provider took the message. failed: it refused, or sending is
    -- not configured. unknown: no provider response, so it may or may not have
    -- been sent. no_recipients: nobody was eligible, nothing was attempted.
    send_outcome TEXT NOT NULL CHECK (send_outcome IN ('accepted', 'failed', 'unknown', 'no_recipients')),
    provider_message_id TEXT CHECK (provider_message_id IS NULL OR char_length(provider_message_id) <= 200),
    failure_code TEXT CHECK (failure_code IS NULL OR failure_code ~ '^[A-Za-z0-9_]{1,80}$'),
    attachment_status TEXT NOT NULL DEFAULT 'not_applicable'
        CHECK (attachment_status IN ('attached', 'failed', 'disabled', 'skipped', 'not_applicable')),
    -- Provider delivery evidence from the signed webhook. NULL means unknown.
    delivery_status TEXT CHECK (delivery_status IS NULL OR delivery_status IN ('delivered', 'delayed', 'bounced', 'complained', 'failed')),
    delivery_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (operation_id, recipient_slot)
);

CREATE INDEX IF NOT EXISTS idx_notification_observations_request_created
    ON notification_observations(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_observations_provider_message
    ON notification_observations(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_observations_created
    ON notification_observations(created_at DESC);

CREATE TABLE IF NOT EXISTS pdf_render_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    -- Set for an email attachment: the notification operation and slot it was rendered for.
    operation_id UUID,
    recipient_slot SMALLINT CHECK (recipient_slot IS NULL OR recipient_slot BETWEEN 0 AND 99),
    surface TEXT NOT NULL CHECK (surface IN ('download', 'completion_attachment')),
    mode TEXT NOT NULL CHECK (mode IN ('live', 'test')),
    packet_mode TEXT CHECK (packet_mode IS NULL OR packet_mode IN ('simple', 'advanced')),
    render_strategy TEXT CHECK (render_strategy IS NULL OR render_strategy IN ('print_pdf', 'screenshot')),
    launch_strategy TEXT CHECK (launch_strategy IS NULL OR launch_strategy IN ('env_executable', 'bin_path', 'pack_url', 'default')),
    outcome TEXT NOT NULL CHECK (outcome IN ('rendered', 'failed', 'skipped')),
    -- Expected outcomes, not renderer incidents.
    skip_reason TEXT CHECK (skip_reason IS NULL OR skip_reason IN ('not_submitted', 'locked')),
    failure_stage TEXT CHECK (failure_stage IS NULL OR failure_stage IN ('data', 'build_html', 'browser_launch', 'page_load', 'render')),
    error_name TEXT CHECK (error_name IS NULL OR error_name ~ '^[A-Za-z0-9_]{1,60}$'),
    -- Coarse response status of the download route. NULL for attachments.
    http_status SMALLINT CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
    total_ms INT CHECK (total_ms IS NULL OR total_ms >= 0),
    data_ms INT CHECK (data_ms IS NULL OR data_ms >= 0),
    launch_ms INT CHECK (launch_ms IS NULL OR launch_ms >= 0),
    render_ms INT CHECK (render_ms IS NULL OR render_ms >= 0),
    bytes INT CHECK (bytes IS NULL OR bytes >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdf_render_observations_request_created
    ON pdf_render_observations(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdf_render_observations_created
    ON pdf_render_observations(created_at DESC);
