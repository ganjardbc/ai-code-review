# TASKS

### **Phase 1: Foundation (Fondasi Proyek)**
*   **000-foundation**: Setup scaffolding awal proyek, file konfigurasi `tsconfig.json`, dan `package.json`.
*   **001-configuration**: Implementasi skema validasi Environment Variables menggunakan Zod dan `dotenv`.
*   **002-logging**: Setup logging terstruktur dengan overhead rendah menggunakan Pino.

### **Phase 2: API (Server & Endpoint Webhook)**
*   **003-http-server**: Setup server HTTP menggunakan Fastify.
*   **004-health**: Pembuatan endpoint `/health` untuk memeriksa status server dan Redis.
*   **005-webhook**: Endpoint webhook untuk GitHub dan GitLab, dilengkapi dengan validasi tanda tangan kriptografis (HMAC signature validation).

### **Phase 3: Queue (Antrean & Worker)**
*   **006-queue**: Konfigurasi antrean BullMQ berbasis Redis untuk memproses pekerjaan secara asinkron.
*   **007-worker**: Pembuatan background worker proses yang mendengarkan antrean dan menjalankan tugas review.

### **Phase 4: Git (Operasi Repositori)**
*   **008-git**: Pembuatan adapter operasi Git yang aman (menggunakan argument arrays untuk mencegah command injection) dan bekerja di dalam sandbox directory unik (UUID).

### **Phase 5: AI (Prompts & Evaluasi Model)**
*   **009-prompt-engine**: Sistem pembangun prompt, pemformatan diff, dan pembatasan batas token konteks (maksimal 40KB).
*   **010-ai-runner**: Integrasi klien HTTP dengan **9Router** untuk menjalankan model **OpenCode**.
*   **011-review-parser**: Parser output AI ke format JSON dan validasi struktur komentarnya menggunakan **Ajv schema validation**.

### **Phase 6: Providers (Integrasi VCS & Orchestrator)**
*   **012-github-provider**: Adapter menggunakan Octokit untuk menulis komentar review secara inline ke baris kode di Pull Request GitHub.
*   **013-gitlab-provider**: Adapter menggunakan Gitbeaker untuk menulis komentar di Merge Request GitLab.
*   **014-review-orchestrator**: Use Case utama yang menghubungkan seluruh alur mulai dari menerima webhook, clone Git, review AI, hingga memposting komentar.
*   **015-cleanup**: Pengelola penghapusan direktori sandbox secara bersih setelah proses review selesai.

### **Phase 7: Deployment & Pengujian**
*   **016-observability**: Metrik pemantauan durasi eksekusi dan pelacakan error.
*   **017-testing**: Pengujian unit dan integrasi untuk memastikan keandalan sistem.
*   **018-deployment**: Konfigurasi Dockerfile multi-stage dan `docker-compose.yml` yang menghubungkan API server, Worker, dan Redis.
