#!/usr/bin/env bash

# ===============================================================================
#                🔬 RUANGLABMU - LABORATORIUM SAINS VIRTUAL 3D
#           Skrip Peluncur Otomatis Server Sekolah 3T (Sekali Klik)
# ===============================================================================

set -e

# Warna Terminal
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}===============================================================================${NC}"
echo -e "${BOLD}               🔬 RUANGLABMU — LABORATORIUM SAINS VIRTUAL 3D${NC}"
echo -e "          Skrip Peluncur Otomatis Server Sekolah 3T (Sekali Klik)"
echo -e "${CYAN}===============================================================================${NC}"
echo ""

echo -e "${BLUE}[1/4] Memeriksa instalasi Node.js & npm...${NC}"
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] Node.js belum terpasang di komputer ini!${NC}"
    echo "Silakan pasang Node.js (versi 22+) dari https://nodejs.org/ terlebih dahulu."
    exit 1
fi
NODE_VER=$(node -v)
echo -e "${GREEN}[OK] Node.js terdeteksi: ${NODE_VER}${NC}"
echo ""

echo -e "${BLUE}[2/4] Memeriksa berkas build laboratorium...${NC}"
if [ ! -d "dist" ] || [ ! -d "dist-server" ]; then
    echo -e "${YELLOW}[INFO] Berkas 'dist' belum ditemukan. Menyiapkan sistem laboratorium...${NC}"
    echo "Sedang menjalankan kompilasi awal (memakan waktu ~30 detik)..."
    npm run build
fi
echo -e "${GREEN}[OK] Berkas laboratorium siap dijalankan.${NC}"
echo ""

echo -e "${BLUE}[3/4] Mendeteksi Alamat IP Wi-Fi Hotspot Komputer Guru...${NC}"
echo -e "${CYAN}-------------------------------------------------------------------------------${NC}"
echo -e "${BOLD}  🌐 CARA MENGHUBUNGKAN SISWA (HOTSPOT TANPA KUOTA INTERNET):${NC}"
echo ""
echo "  1. Nyalakan 'Wi-Fi Hotspot' / tethering di laptop ini tanpa perlu paket data."
echo "  2. Minta siswa menghubungkan HP/tablet ke jaringan Wi-Fi tersebut."
echo "  3. Siswa cukup membuka browser dan mengetik alamat di bawah ini:"
echo ""

# Deteksi IP lokal di Linux atau macOS
FOUND_IP=false
if command -v hostname >/dev/null 2>&1 && hostname -I >/dev/null 2>&1; then
    for ip in $(hostname -I); do
        if [[ ! "$ip" =~ ^127\. ]] && [[ ! "$ip" =~ ^172\.17\. ]] && [[ ! "$ip" =~ : ]]; then
            echo -e "       ${GREEN}👉 http://${ip}:3000${NC}"
            FOUND_IP=true
        fi
    done
fi

if [ "$FOUND_IP" = false ] && command -v ip >/dev/null 2>&1; then
    for ip in $(ip -4 addr show scope global | grep -oP '(?<=inet\s)\d+(\.\d+){3}'); do
        echo -e "       ${GREEN}👉 http://${ip}:3000${NC}"
        FOUND_IP=true
    done
fi

if [ "$FOUND_IP" = false ] && command -v ifconfig >/dev/null 2>&1; then
    for ip in $(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1'); do
        echo -e "       ${GREEN}👉 http://${ip}:3000${NC}"
        FOUND_IP=true
    done
fi

echo ""
echo -e "  💻 Di komputer guru ini langsung buka: ${BOLD}http://localhost:3000${NC}"
echo -e "${CYAN}-------------------------------------------------------------------------------${NC}"
echo ""

echo -e "${BLUE}[4/4] Membuka browser default dan menyalakan server lokal...${NC}"
sleep 1

# Otomatis buka browser sesuai OS
if command -v xdg-open >/dev/null 2>&1; then
    (sleep 1.5 && xdg-open "http://localhost:3000") &
elif command -v open >/dev/null 2>&1; then
    (sleep 1.5 && open "http://localhost:3000") &
fi

echo ""
echo -e "${GREEN}===============================================================================${NC}"
echo -e "${BOLD}   ✅ SERVER AKTIF! JANGAN TUTUP TERMINAL INI SELAMA PRAKTIKUM BERLANGSUNG${NC}"
echo -e "   Tekan ${YELLOW}Ctrl + C${NC} di terminal ini untuk mematikan server setelah kelas selesai."
echo -e "${GREEN}===============================================================================${NC}"
echo ""

npm start
