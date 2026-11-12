@echo off
chcp 65001 >nul
title RuangLABmu - Peluncur Laboratorium Sekolah 3T
color 0B

echo ===============================================================================
echo                🔬 RUANGLABMU - LABORATORIUM SAINS VIRTUAL 3D
echo           Skrip Peluncur Otomatis Server Sekolah 3T (Sekali Klik)
echo ===============================================================================
echo.
echo [1/4] Memeriksa instalasi Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js belum terpasang di komputer ini!
    echo Silakan unduh dan pasang Node.js dari https://nodejs.org/ lalu jalankan kembali skrip ini.
    echo Tekan sembarang tombol untuk keluar.
    pause >nul
    exit /b 1
)
echo [OK] Node.js terdeteksi.
echo.

echo [2/4] Memeriksa berkas build laboratorium...
if not exist "dist" (
    echo [INFO] Berkas 'dist' belum ditemukan. Menyiapkan sistem laboratorium...
    echo Sedang menjalankan kompilasi awal (hanya memakan waktu 30-60 detik)...
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo [PERINGATAN] Build produksi terkendala. Membuka dalam mode pengembang (dev mode)...
        goto START_DEV
    )
) else (
    echo [OK] Berkas laboratorium siap dijalankan.
)
echo.

echo [3/4] Mendeteksi Alamat IP Wi-Fi Hotspot Komputer Guru...
echo -------------------------------------------------------------------------------
echo   🌐 CARA MENGHUBUNGKAN SISWA (HOTSPOT TANPA KUOTA INTERNET):
echo.
echo   1. Nyalakan fitur "Mobile Hotspot" di Windows (Pengaturan -> Jaringan).
echo   2. Minta siswa menghubungkan HP/tablet ke Wi-Fi Hotspot laptop guru.
echo   3. Siswa cukup membuka browser dan mengetik salah satu alamat IP di bawah:
echo.
for /f "tokens=4" %%a in ('route print 0.0.0.0 ^| findstr 0.0.0.0 ^| findstr /v "Persistent"') do (
    echo       👉 http://%%a:3000
)
echo.
echo   (Jika alamat di atas tidak muncul, cek alamat IPv4 pada 'ipconfig' port 3000)
echo   Di laptop guru ini: http://localhost:3000
echo -------------------------------------------------------------------------------
echo.

echo [4/4] Membuka browser default dan menyalakan server lokal...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo ===============================================================================
echo    ✅ SERVER AKTIF! JANGAN TUTUP JENDELA INI SELAMA PRAKTIKUM BERLANGSUNG
echo    Tekan Ctrl + C di jendela ini untuk mematikan server setelah kelas selesai.
echo ===============================================================================
echo.
npm start
goto END

:START_DEV
echo Menyalakan server via mode dev...
timeout /t 2 /nobreak >nul
start http://localhost:3000
npm run dev

:END
pause
