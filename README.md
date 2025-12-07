# 🖥️ Novaterm

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

**A modern web-based SSH terminal and server management platform**

*Built with Next.js, Socket.IO, and SSH2*

</div>

---

## ✨ Features

### 🔐 SSH Terminal
- **Web-based Terminal** - Full xterm.js terminal with color support
- **Session Management** - Reconnect to existing sessions
- **Multiple Connections** - Save and manage connection profiles
- **Key Authentication** - Support for SSH keys and passphrases

### 📁 File Management
- **SFTP Browser** - Navigate remote filesystems
- **Monaco Editor** - Edit files with syntax highlighting
- **File Operations** - Create, rename, delete files and folders
- **Context Menus** - Right-click actions for common operations

### 📊 Server Monitoring
- **System Dashboard** - Real-time CPU, RAM, disk, network metrics
- **Process Monitor** - View and manage running processes
- **Log Viewer** - Stream and analyze system logs (syslog, journald)
- **Network Monitor** - Active connections, bandwidth, port scanning

### 🛡️ CTF Tools
- **Reconnaissance** - Nmap integration with presets
- **Web Testing** - ffuf, SQLMap, Nikto
- **Password Cracking** - John the Ripper, Hashcat, Hydra
- **Forensics** - Binwalk, Steghide, ExifTool, Volatility
- **Privilege Escalation** - LinPEAS, WinPEAS, sudo exploits
- **Installation Utilities** - One-click install for common tools

### 🔥 Additional Features
- **IPTables Generator** - Visual firewall rule builder
- **Package Manager** - Search and install packages
- **Script Runner** - Execute custom scripts with sudo support
- **AI Assistant** - Ollama-powered terminal assistance
- **Theme System** - Multiple dark/light themes

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MySQL 8.0+
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/novaterm.git
cd novaterm
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp env.example .env
```

Edit `.env` with your settings:
```env
DATABASE_URL="mysql://user:password@localhost:3306/novaterm"
JWT_SECRET="your-secure-secret-key"
ENCRYPTION_SECRET="your-32-char-encryption-key"
OLLAMA_HOST="http://localhost:11434"
SOCKET_HOST="http://localhost:3000"
NEXT_PUBLIC_SOCKET_HOST="http://localhost:3000"
```

4. **Setup database**
```bash
npm run db:push
npm run db:seed  # Creates demo user: demo@example.com / password123
```

5. **Start the server**
```bash
# Development
npm run dev:server

# Production
npm run build
npm run start:server
```

6. **Open in browser**
```
http://localhost:3000
```

---

## 🐳 Docker Deployment

### Quick Start with Docker

1. **Configure environment**
```bash
cp docker.env.example .env
```

2. **Build and start**
```bash
docker compose up -d
```

3. **Initialize database**
```bash
docker compose exec app npx prisma db push
docker compose exec app npx prisma db seed
```

4. **Access the app**
```
http://localhost:3000
```

### Docker Commands

```bash
# Build the image
npm run docker:build

# Start containers
npm run docker:up

# View logs
npm run docker:logs

# Stop containers
npm run docker:down

# Clean everything (including data)
npm run docker:clean
```

### Docker Compose Services

| Service | Port | Description |
|---------|------|-------------|
| `app` | 3000 | Novaterm application |
| `db` | 3306 | MySQL database |
| `ollama` | 11434 | AI service (optional) |

---

## 📖 Usage

### SSH Connection

1. Enter your server details (IP, port, username)
2. Choose authentication method (password or SSH key)
3. Click **Connect**
4. Use the terminal as you would a native SSH client

### File Browser

1. Connect to a server via SSH
2. Navigate to **Files** in the sidebar
3. Browse directories, open files in the editor
4. Right-click for context menu actions

### Monitoring

1. Connect to a server via SSH
2. Navigate to **Monitoring** in the sidebar
3. Click **Start Monitoring** to begin collecting metrics
4. View real-time graphs and process lists

### CTF Tools

1. Connect to a server via SSH
2. Navigate to **CTF Tools** in the sidebar
3. Select a tool category (Recon, Web, Crypto, etc.)
4. Choose a preset or configure arguments
5. Execute commands with real-time output

---

## 🏗️ Architecture

```
novaterm/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (auth, connections)
│   ├── app/               # Protected app pages
│   │   ├── ctf/          # CTF tools pages
│   │   ├── files/        # File browser
│   │   ├── monitoring/   # Server monitoring
│   │   └── ...
│   └── (auth)/           # Login/register pages
├── components/            # React components
│   ├── app/              # App-specific components
│   └── ui/               # shadcn/ui components
├── contexts/             # React contexts
├── server/               # Socket.IO server
│   ├── handlers/         # Event handlers
│   ├── services/         # Business logic
│   ├── session/          # Session management
│   └── utils/            # Utilities
├── scripts/              # Shell scripts for server ops
└── prisma/               # Database schema
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui |
| Terminal | xterm.js |
| Editor | Monaco Editor |
| Backend | Node.js, Socket.IO |
| SSH | ssh2 library |
| Database | MySQL, Prisma ORM |
| AI | Ollama (optional) |

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | Required |
| `JWT_SECRET` | Secret for JWT tokens | Required |
| `ENCRYPTION_SECRET` | Key for encrypting stored passwords | Required |
| `OLLAMA_HOST` | Ollama API endpoint | `http://localhost:11434` |
| `PORT` | Server port | `3000` |

### Themes

Available themes:
- Dark (default)
- Light
- Dark Green (Hacker)
- Dark Blue
- Dark Violet
- Dark Yellow
- Cream Indigo

Change themes via the theme selector in the app header.

---

## 🔒 Security

- **JWT Authentication** - HTTP-only cookies for session management
- **Password Encryption** - Stored SSH passwords are encrypted
- **Non-root Docker** - Container runs as unprivileged user
- **Input Validation** - Zod schemas for API validation

### Production Recommendations

1. Use strong, unique values for `JWT_SECRET` and `ENCRYPTION_SECRET`
2. Enable HTTPS with a reverse proxy (nginx, Caddy)
3. Restrict database access to internal networks
4. Regularly update dependencies
5. Use SSH keys instead of passwords when possible

---

## 📝 Scripts

### NPM Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start Next.js in development mode |
| `dev:server` | Start full server (Next.js + Socket.IO) |
| `build` | Build for production |
| `start:server` | Start production server |
| `db:push` | Push Prisma schema to database |
| `db:seed` | Seed demo user |
| `docker:up` | Start Docker containers |
| `docker:down` | Stop Docker containers |
| `docker:logs` | View Docker logs |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [ssh2](https://github.com/mscdex/ssh2) - SSH client
- [Socket.IO](https://socket.io/) - Real-time communication
- [Prisma](https://www.prisma.io/) - Database ORM
- [Ollama](https://ollama.ai/) - Local AI models

---

<div align="center">

**Made with ❤️ for the security community**

</div>
