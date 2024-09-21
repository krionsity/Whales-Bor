const fs = require('fs');
const fetch = require('node-fetch');
const Table = require('cli-table3');  // Import cli-table3

// Fungsi untuk membaca banyak token dari file data.txt
function readTokensFromFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.log("Error membaca data.txt:", err);
                return reject(err);
            }
            const tokens = data.trim().split('\n').map(token => token.trim()); // Pisahkan setiap token per baris
            resolve(tokens);
        });
    });
}

// Fungsi untuk mengambil username, total clicks, dan nextSpin dari respons API
async function fetchUserSync(token) {
    try {
        const response = await fetch("https://clicker-api.crashgame247.io/user/sync", {
            headers: {
                "accept": "application/json, text/plain, */*",
                "authorization": `Bearer ${token}`,
                "content-type": "application/json",
                "accept-language": "en,en-US;q=0.9",
                "priority": "u=1, i",
                "sec-ch-ua": "\"Chromium\";v=\"128\", \"Not;A=Brand\";v=\"24\", \"Android WebView\";v=\"128\"",
                "sec-ch-ua-mobile": "?1",
                "sec-ch-ua-platform": "\"Android\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site",
                "Referer": "https://clicker.crashgame247.io/",
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            method: "POST",
            body: JSON.stringify({
                "dataCheckChain": "",
                "initData": {
                    "query_id": "",
                    "user": {
                        "id": 1106627137,
                        "first_name": "",
                        "last_name": "",
                        "username": "",
                        "language_code": "en",
                        "allows_write_to_pm": true
                    },
                    "auth_date": "",
                    "hash": ""
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            
            // Ekstrak informasi yang diperlukan
            const username = data.user.username || "Tidak diketahui";
            const totalClicks = data.meta.totalClicks || 0;

            return { username, totalClicks }; // Mengembalikan objek dengan username dan totalClicks
        } else {
            console.error(`Gagal mengambil data. Status code: ${response.status}`);
        }
    } catch (error) {
        console.error("Error saat mengambil data user sync:", error);
    }
}

// Fungsi untuk klaim bonus harian
async function claimDailyBonus(token) {
    console.log("Mengklaim bonus harian...");

    const response = await fetch("https://clicker-api.crashgame247.io/user/bonus/claim", {
        headers: {
            "accept": "application/json, text/plain, */*",
            "authorization": `Bearer ${token}`,
        },
        method: "PATCH"
    });

    const data = await response.json();
    if (data) {
        console.log("Bonus harian berhasil diklaim.");
    } else {
        console.log("Gagal mengklaim bonus harian.");
    }
}

// Fungsi untuk klaim bonus harian setiap 24 jam
function startDailyBonusClaimLoop(tokens) {
    setInterval(async () => {
        console.log("Memulai klaim bonus harian untuk semua akun...");
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            await claimDailyBonus(token); // Klaim bonus harian untuk setiap akun
        }
        console.log("Selesai klaim bonus harian.");
    }, 24 * 60 * 60 * 1000); // 24 jam dalam milidetik (24 jam = 86.400.000 milidetik)
}

// Fungsi untuk melakukan clicker dan memperbarui tabel
async function performClicker(token, clickCount, index, username, table) {
    const response = await fetch("https://clicker-api.crashgame247.io/meta/clicker", {
        headers: {
            "accept": "application/json, text/plain, */*",
            "authorization": `Bearer ${token}`,
            "content-type": "application/json",
        },
        method: "PATCH",
        body: JSON.stringify({ "clicks": clickCount }) // Kirim nilai clicks yang bertambah
    });

    const data = await response.json();
    if (data) {
        // Update tabel untuk akun ini
        table[index][2] = clickCount;
        console.clear();
        console.log(table.toString()); // Tampilkan tabel terbaru di terminal
    }
}

// Fungsi untuk loop clicker dengan menggunakan totalClicks dari fetchUserSync
async function performClickerLoop(token, startingClickCount, index, username, table) {
    let clickCount = startingClickCount + 1; // Mulai dari total clicks yang ada +1
    try {
        while (true) {  // Loop tanpa henti
            await performClicker(token, clickCount, index, username, table);
            clickCount++; // Tambah nilai clicks setiap iterasi
            await new Promise(resolve => setTimeout(resolve, 1000)); // Cooldown 1 detik
        }
    } catch (error) {
        console.error("Error dalam performClickerLoop:", error);
    }
}

// Fungsi utama
async function main() {
    try {
        const tokens = await readTokensFromFile('data.txt'); // Baca semua token dari file
        console.log("Menggunakan token dari data.txt...");

        const userInfos = []; // Menyimpan data user info untuk setiap token

        // Buat tabel untuk menyimpan dan menampilkan klik
        const table = new Table({
            head: ['No.', 'Username', 'Clicks'],  // Judul kolom
            colWidths: [10, 20, 15]               // Lebar kolom
        });

        // Langkah 1: Lakukan fungsi lain selain clicker untuk semua akun
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            // Ambil total clicks dan username dari fetchUserSync
            const userInfo = await fetchUserSync(token);
            if (!userInfo) continue;

            const { username, totalClicks } = userInfo;
            console.log(`\nAkun${i + 1} (${username}) dimulai dengan ${totalClicks} clicks.`);

            // Klaim bonus harian
            await claimDailyBonus(token);

            // Simpan userInfo untuk digunakan di fungsi clicker nanti
            userInfos.push({ token, totalClicks, username, index: i });

            // Tambah baris ke tabel untuk akun ini
            table.push([i + 1, username, totalClicks]);
        }

        // Mulai klaim bonus harian setiap 24 jam
        startDailyBonusClaimLoop(tokens);

        // Langkah 2: Clear logs dan jalankan fungsi clicker untuk semua akun
        console.clear(); // Bersihkan log
        console.log(table.toString()); // Tampilkan tabel awal di terminal

        for (const userInfo of userInfos) {
            performClickerLoop(userInfo.token, userInfo.totalClicks, userInfo.index, userInfo.username, table);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

// Menjalankan fungsi utama
main();
