import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import axios from "axios";

const GiftTracker = () => {
    const [websocket, setWebsocket] = useState(null);
    const [status, setStatus] = useState("Disconnected");
    const [giftTypeCounts, setGiftTypeCounts] = useState({});
    const [gifts, setGifts] = useState([]);
    const recipients = ["Simi", "Hana", "Cindy", "Sakura", "Cherry"];
    const displayedGiftTypes = ["Potato", "Ice cream", "Finger Heart", "Peach", "Phoenix Flower"];
    const API_URL = import.meta.env.VITE_API_URL;
    useEffect(() => {
        const fetchGifts = async () => {
            const res = await axios.get(`${API_URL}/api/gifts`);
            setGifts(res.data);
        };
        fetchGifts();

        const fetchGiftTypes = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/gifts/types`);
                setGiftTypeCounts(res.data); 
            } catch (error) {
                console.error("Error fetching gift types:", error);
            }
        };
        fetchGiftTypes();

        const connect = () => {
            if (websocket) return;
            const ws = new WebSocket("ws://localhost:21213/");
            setWebsocket(ws);

            ws.onopen = () => setStatus("Connected");
            ws.onclose = () => {
                setStatus("Disconnected");
                setWebsocket(null);
                setTimeout(connect, 1000);
            };
            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                setStatus("Connection Failed");
                setWebsocket(null);
                setTimeout(connect, 1000);
            };
            ws.onmessage = async (event) => {
                try {
                    const parsedData = JSON.parse(event.data);
                    if (parsedData.event === "gift") {
                        const { nickname, giftName, repeatCount, repeatEnd, gift, giftPictureUrl } = parsedData.data;
                        if (repeatEnd === true || gift.gift_type !== 1) {
                            const giftValue = parsedData.data.diamondCount * repeatCount;
                            const newGift = {
                                sender: nickname,
                                giftName,
                                giftImage: giftPictureUrl,
                                repeatCount,
                                count: giftValue,
                                recipient: ""
                            };
                           
                            const res = await axios.post(`${API_URL}/api/gifts`, newGift);
                            const savedGift = res.data; 
                            setGifts((prev) => [savedGift, ...prev]); 
                        }
                    }
                } catch (error) {
                    console.error("Error parsing WebSocket message:", error);
                }
            };
        };
        connect();
        return () => websocket && websocket.close();
    }, [websocket]);


    const updateRecipient = async (index, recipient) => {
        const updatedGift = { ...gifts[index], recipient };

        try {
            await axios.put(`${API_URL}/api/gifts/${updatedGift._id}`, { recipient });
            setGifts((prevGifts) =>
                prevGifts.map((gift, i) => (i === index ? updatedGift : gift))
            );
        } catch (error) {
            console.error("Error updating recipient:", error);
        }
    };

    const exportToExcel = () => {
        const wsData = [recipients];
        const groupedData = recipients.reduce((acc, name) => ({ ...acc, [name]: [] }), {});

        gifts.forEach(({ recipient, count }) => {
            if (recipient) groupedData[recipient].push(count);
        });

        const maxRows = Math.max(...Object.values(groupedData).map(arr => arr.length), 1);
        const formattedData = Array.from({ length: maxRows }, (_, rowIndex) =>
            recipients.map(name => groupedData[name][rowIndex] || "")
        );

        wsData.push(...formattedData);



        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Gifts");

        XLSX.utils.sheet_add_aoa(ws, [recipients], { origin: "H1" });
        // Lọc giá trị của các loại quà dựa trên displayedGiftTypes
        const filteredGiftCounts = displayedGiftTypes.map((giftType) => giftTypeCounts[giftType] || 0);
        // Thêm giá trị của các loại quà vào hàng thứ hai (H2 đến L2)
        XLSX.utils.sheet_add_aoa(ws, [filteredGiftCounts], { origin: "H2" });

        // Thêm totalCoins vào cell A2
        XLSX.utils.sheet_add_aoa(ws, [["Tong ngay: ", totalCoins]], { origin: "M6" });
        XLSX.writeFile(wb, "gift_tracking.xlsx");
    };
    const totalCoins = gifts.reduce((total, gift) => total + gift.count, 0);

    return (
        <div className="p-4">
            <div className="flex justify-between items-center p-2">
                <h2 className="text-2xl font-semibold">Status: {status}</h2>
               
                <h2 className="text-2xl font-semibold">
                    Total: {totalCoins} xu |{" "}
                    {displayedGiftTypes
                        .map((giftType) => `${giftType}: ${giftTypeCounts[giftType] || 0}`)
                        .join(" | ")}
                </h2>
                <button onClick={exportToExcel} className="bg-blue-500 hover:bg-blue-300 text-white px-4 py-2 rounded-md">
                    Export Excel
                </button>
            </div>
            <div className="mt-4">
                <h2 className="text-lg font-bold mb-2">Danh sách quà tặng:</h2>
                {gifts.length === 0 ? (
                    <p>Chưa có quà tặng nào.</p>
                ) : (
                    gifts.map(({ _id, sender, giftName, giftImage, repeatCount, count, recipient }, index) => (
                        <div key={_id} className="grid grid-cols-[150px_150px_100px_100px_150px_1fr] items-center gap-4 p-2 border-b hover:bg-blue-200 transition">
                            <div className="font-bold">{sender}</div>
                            <div>{giftName}</div>
                            <img src={giftImage} alt={giftName} className="w-10 h-10 object-contain" />
                            <div>x {repeatCount}</div>
                            <div className="font-bold">{count} xu</div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm">Chọn người nhận:</label>
                                <select
                                    value={recipient}
                                    onChange={(e) => updateRecipient(index, e.target.value)}
                                    className="border px-2 py-1 text-sm"
                                >
                                    <option value="">-- Chọn --</option>
                                    {recipients.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                                <div className="text-sm text-right">
                                    {recipient ? <strong>{recipient}</strong> : "Chưa chọn"}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default GiftTracker;



