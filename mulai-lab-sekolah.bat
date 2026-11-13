@echo off
chcp 65001 >nul
title RuangLABmu - Peluncur Laboratorium Sekolah 3T
color 0B

echo ===============================================================================
echo                RUANGLABMU - LABORATORIUM SAINS VIRTUAL 3D
echo           Skrip Peluncur Otomatis Server Sekolah 3T (Sekali Klik)
echo ===============================================================================
echo.
echo [1/4] Memeriksa instalasi Node.js dan dependensi...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Node.js belum terpasang di komputer ini!
    echo.
    echo Cara memperbaiki:
    echo   1. Unduh Node.js versi LTS ^(22+^) dari https://nodejs.org/
    echo   2. Jalankan installer sampai selesai, lalu tutup dan buka kembali skrip ini.
    echo.
    echo Tekan sembarang tombol untuk keluar...
    pause >nul
    exit /b 1
)
for /f "delims=" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js terdeteksi: %NODE_VER%

if not exist "node_modules" (
    echo [INFO] Folder 'node_modules' belum ada. Memasang paket laboratorium...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Gagal memasang dependensi. Pastikan koneksi internet aktif saat instalasi pertama.
        pause
        exit /b 1
    )
)
echo.

echo [2/4] Memeriksa berkas build laboratorium...
if not exist "dist" goto DO_BUILD
if not exist "dist-server\server.cjs" goto DO_BUILD
echo [OK] Berkas laboratorium siap dijalankan.
goto AFTER_BUILD

:DO_BUILD
echo [INFO] Berkas build produksi belum lengkap. Menyiapkan sistem laboratorium...
echo Sedang menjalankan kompilasi awal ^(hanya memakan waktu 30-60 detik^)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [PERINGATAN] Build produksi terkendala. Membuka dalam mode pengembang ^(dev mode^)...
    goto START_DEV
)

:AFTER_BUILD
echo.
echo [3/4] Mendeteksi Alamat IP Wi-Fi Hotspot Komputer Guru...
echo -------------------------------------------------------------------------------
echo   CARA MENGHUBUNGKAN SISWA ^(HOTSPOT TANPA KUOTA INTERNET^):
echo.
echo   1. Nyalakan fitur "Mobile Hotspot" di Windows ^(Pengaturan -^> Jaringan^).
echo   2. Minta siswa menghubungkan HP/tablet ke Wi-Fi Hotspot laptop guru.
echo   3. PENTING: Jika muncul pop-up "Windows Defender Firewall",
echo      klik "Allow access" / "Izinkan akses" agar HP siswa bisa terhubung!
echo   4. Siswa membuka browser dan mengetik salah satu alamat IP di bawah:
echo.
for /f "tokens=4" %%a in ('route print 0.0.0.0 ^| findstr 0.0.0.0 ^| findstr /v "Persistent"') do (
    echo       --^> http://%%a:3000
)
echo.
echo   Catatan: Jika port 3000 sedang dipakai aplikasi lain, server otomatis
echo   berpindah ke port 3001, 3002, dst. Cek alamat aktif pada log di bawah ini.
echo   Di laptop guru ini: http://localhost:3000
echo -------------------------------------------------------------------------------
echo.

echo [4/4] Membuka browser default dan menyalakan server lokal...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo ===============================================================================
echo    SERVER AKTIF! JANGAN TUTUP JENDELA INI SELAMA PRAKTIKUM BERLANGSUNG
echo    Tekan Ctrl + C di jendela ini untuk mematikan server setelah kelas selesai.
echo ===============================================================================
echo.
npm start
goto END

:START_DEV
echo.
echo [PERINGATAN FIREWALL] Jika muncul pop-up Windows Defender Firewall,
echo klik "Allow access" agar HP siswa di Wi-Fi lokal dapat terhubung!
echo Menyalakan server via mode dev...
timeout /t 2 /nobreak >nul
start http://localhost:3000
npm run dev

:END
echo.
echo Server telah berhenti. Tekan sembarang tombol untuk menutup jendela ini.
pause >nul
