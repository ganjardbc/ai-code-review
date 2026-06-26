# TLS / SSL Configuration

The AI Code Reviewer API server itself does not handle TLS — terminate SSL at the reverse proxy layer. This document covers the most common setups.

---

## Option 1: Caddy (Recommended — Automatic HTTPS)

Caddy provisions and renews Let's Encrypt certificates automatically. No manual certificate management is required.

### Install Caddy

```bash
# Debian/Ubuntu
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

### Caddyfile

```caddy
reviewer.example.com {
    reverse_proxy localhost:3000
}
```

That is the entire configuration. Caddy:

1. Obtains a certificate from Let's Encrypt on first request
2. Configures HTTP → HTTPS redirect automatically
3. Renews certificates before they expire

```bash
sudo systemctl enable --now caddy
caddy reload --config /etc/caddy/Caddyfile
```

> **Requirement:** Port 80 and 443 must be reachable from the internet for ACME HTTP-01 challenge. DNS must point to this server.

---

## Option 2: Let's Encrypt with Nginx + Certbot

### Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Obtain a Certificate

```bash
sudo certbot --nginx -d reviewer.example.com
```

Certbot modifies your Nginx configuration to add the certificate paths and set up the HTTP redirect automatically.

### Manual Certificate Paths

If you prefer to manage the Nginx config yourself:

```nginx
server {
    listen 443 ssl http2;
    server_name reviewer.example.com;

    ssl_certificate     /etc/letsencrypt/live/reviewer.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reviewer.example.com/privkey.pem;

    # Mozilla Intermediate configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS (optional but recommended)
    add_header Strict-Transport-Security "max-age=63072000" always;

    # ... proxy settings from reverse-proxy.md
}
```

### Auto-Renewal

Certbot installs a systemd timer or cron job that renews certificates automatically. Verify it:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

---

## Option 3: Self-Signed Certificate (Internal / Development)

Use this for internal deployments, staging environments, or when you control all clients.

### Generate a Self-Signed Certificate

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
  -keyout /etc/ssl/private/ai-reviewer.key \
  -out /etc/ssl/certs/ai-reviewer.crt \
  -subj "/C=US/ST=State/L=City/O=YourOrg/CN=reviewer.internal"
```

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name reviewer.internal;

    ssl_certificate     /etc/ssl/certs/ai-reviewer.crt;
    ssl_certificate_key /etc/ssl/private/ai-reviewer.key;

    # ... proxy settings
}
```

> **Warning:** GitHub and GitLab webhook deliveries will fail with `SSL certificate problem: self signed certificate` unless:
> - You add the certificate to the VCS provider's trusted CA store (GitLab supports this under Admin → Settings → Network → Outbound requests), or
> - You configure the webhook URL to skip TLS verification (GitHub does not support this; GitLab does in self-managed deployments).

### Internal CA (Recommended for Self-Hosted)

If you have an internal CA, issue a certificate from it:

```bash
# Sign a CSR with your internal CA
openssl x509 -req -in ai-reviewer.csr \
  -CA /etc/pki/CA/cacert.pem \
  -CAkey /etc/pki/CA/private/cakey.pem \
  -CAcreateserial -out ai-reviewer.crt -days 365
```

Distribute the internal CA certificate to all clients (including the VCS provider's trust store).

---

## Environment Variables for HTTPS

The application itself does not need HTTPS-specific environment variables — TLS is handled by the proxy. However, document the public-facing URL in your `.env` for any feature that needs to construct callback URLs:

```dotenv
# Public URL (used if the app constructs absolute URLs in responses)
PUBLIC_URL=https://reviewer.example.com
```

> **Note:** As of this version, the application does not construct absolute URLs. This variable is for documentation purposes and future use.

---

## Verifying TLS Configuration

```bash
# Check certificate details
openssl s_client -connect reviewer.example.com:443 -servername reviewer.example.com < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -E 'Not After|Subject:'

# Check for common misconfigurations
curl -I https://reviewer.example.com/health
```

Use [SSL Labs](https://www.ssllabs.com/ssltest/) for a full TLS grade report on public-facing deployments.
