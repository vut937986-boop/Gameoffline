window.NEON_BREW_CATALOG = Object.freeze({
  recipes: [
    {id:'meteor',name:'Latte',icon:'☕',short:'Latte',details:'espresso · sữa tươi · foam sữa',price:36000,recipe:'Cà phê espresso · sữa tươi · foam sữa',tags:['caffeine','milk','hot'],steps:['GRIND','BREW','MILK','FOAM'],unlockLevel:1},
    {id:'matcha',name:'Cappuccino',icon:'☕',short:'Cappuccino',details:'espresso · sữa nóng · bọt sữa',price:34000,recipe:'Cà phê espresso · sữa nóng · bọt sữa',tags:['caffeine','milk','bold'],steps:['GRIND','BREW','MILK','FOAM'],unlockLevel:5},
    {id:'mocha',name:'Mocha',icon:'☕',short:'Mocha',details:'espresso · cacao · sữa tươi',price:42000,recipe:'Cà phê espresso · cacao · sữa tươi',tags:['caffeine','bold','hot'],steps:['GRIND','BREW','MILK','SYRUP'],unlockLevel:7},
    {id:'ramen',name:'Americano',icon:'☕',short:'Americano',details:'espresso · nước nóng',price:29000,recipe:'Cà phê espresso · nước nóng',tags:['caffeine','light'],steps:['GRIND','BREW','WATER'],unlockLevel:2},
    {id:'overclock',name:'Caramel Macchiato',icon:'☕',short:'Macchiato',details:'espresso · sữa tươi · siro caramel',price:45000,recipe:'Cà phê espresso · sữa tươi · siro caramel',tags:['caffeine','milk','premium'],steps:['GRIND','BREW','MILK','SYRUP','FOAM'],unlockLevel:10},
    {id:'bionic',name:'Cold Brew',icon:'🧋',short:'Cold Brew',details:'cà phê ủ lạnh · kem tươi',price:39000,recipe:'Cà phê ủ lạnh · đá · kem tươi',tags:['caffeine','cold','premium'],steps:['GRIND','BREW','ICE','CREAM'],unlockLevel:15}
  ],
  ingredients: [
    {id:'espresso',name:'Hạt cà phê rang',icon:'🫘',cost:6000,start:10,shelfLife:7,tag:'caffeine'},
    {id:'plasma',name:'Sữa tươi',icon:'🥛',cost:5000,start:10,shelfLife:3,tag:'milk'},
    {id:'boba',name:'Kem tươi',icon:'🍦',cost:4000,start:6,shelfLife:2,tag:'topping'},
    {id:'syrup',name:'Siro caramel',icon:'🍯',cost:3000,start:6,shelfLife:7,tag:'premium'}
  ],
  factions: [
    {id:'hackers',name:'Khách quen',icon:'🙂',want:'caffeine',perk:'Khách quen yêu thích cà phê đậm vị.'},
    {id:'samurai',name:'Sinh viên',icon:'🎒',want:'bold',perk:'Sinh viên thường gọi món đậm vị.'},
    {id:'corporate',name:'Dân văn phòng',icon:'💼',want:'premium',perk:'Dân văn phòng thích món đặc biệt.'},
    {id:'cyborgs',name:'Khách đi đường',icon:'🚶',want:'cold',perk:'Khách đi đường thường chọn đồ uống lạnh.'}
  ],
  customers: [
    {id:'minh',name:'Minh',type:'student',faction:'samurai',favoriteDrink:'matcha',difficulty:'easy',unlockLevel:1,rewardModifier:1,tipModifier:1},
    {id:'linh',name:'Linh',type:'student',faction:'samurai',favoriteDrink:'meteor',difficulty:'normal',unlockLevel:1,rewardModifier:1,tipModifier:1.05},
    {id:'an',name:'An',type:'office',faction:'corporate',favoriteDrink:'overclock',difficulty:'normal',unlockLevel:3,rewardModifier:1.1,tipModifier:1.1},
    {id:'vy',name:'Vy',type:'office',faction:'corporate',favoriteDrink:'mocha',difficulty:'hard',unlockLevel:5,rewardModifier:1.08,tipModifier:1.1},
    {id:'khoa',name:'Khoa',type:'cyberpunk',faction:'hackers',favoriteDrink:'mocha',difficulty:'hard',unlockLevel:5,rewardModifier:1.08,tipModifier:1.15},
    {id:'mai',name:'Mai',type:'hacker',faction:'hackers',favoriteDrink:'meteor',difficulty:'normal',unlockLevel:4,rewardModifier:1.05,tipModifier:1.2},
    {id:'unit-07',name:'UNIT-07',type:'robot',faction:'cyborgs',favoriteDrink:'bionic',difficulty:'elite',unlockLevel:15,rewardModifier:1.2,tipModifier:0},
    {id:'nam',name:'Nam',type:'night-worker',faction:'cyborgs',favoriteDrink:'ramen',difficulty:'normal',unlockLevel:5,rewardModifier:1.05,tipModifier:1.1}
  ],
  weathers: [
    {id:'acid',name:'Ngày mưa',icon:'🌧️',effect:'Khách thích một ly cà phê ấm.'},
    {id:'fog',name:'Trời nhiều mây',icon:'☁️',effect:'Một ngày dịu mát tại quán.'},
    {id:'neon',name:'Nắng nhẹ',icon:'☀️',effect:'Thời tiết đẹp, khách ghé quán đều đặn.'}
  ],
  decorItems: [
    {id:'neonSign',name:'Bảng menu gỗ',icon:'🪧',description:'Một chiếc menu ấm áp cho quầy cà phê.',cost:220000},
    {id:'pixelFloor',name:'Bình hoa tươi',icon:'💐',description:'Thêm sắc xanh cho góc quán.',cost:180000},
    {id:'airFilter',name:'Đèn bàn ấm',icon:'💡',description:'Tạo không gian dễ chịu cho khách.',cost:260000}
  ],
  tracks: [
    {id:'afterglow',name:'Buổi sáng yên',style:'Giai điệu êm · 70 BPM',cost:0,notes:[261.63,329.63,392,440,392,329.63,293.66,329.63]},
    {id:'rain',name:'Cửa sổ ngày mưa',style:'Piano dịu · 68 BPM',cost:160,notes:[293.66,349.23,392,523.25,440,392,349.23,293.66]},
    {id:'synth',name:'Góc quán thân quen',style:'Cafe thư giãn · 72 BPM',cost:260,notes:[261.63,329.63,392,493.88,440,392,329.63,293.66]}
  ],
  storyEvents: {
    ransomware:{title:'Robot bị nhiễm Ransomware',copy:'☠ Màn hình hiện đầu lâu. Hacker khóa firmware barista và đòi 10% quỹ bằng Bitcoin / Credits.'},
    union:{title:'Lớp Học Yêu Thương Rô-bốt',copy:'Liên đoàn robot đòi dầu nhớt tốt và 30 phút sạc/ngày. Chấp nhận: bảo trì +5%/giờ, tốc độ +15%. Format: 30% hồi phục, 70% mất 1 robot.'},
    yakuza:{title:'Yakuza ghé thăm',copy:'Mùi Ramen Synth-Pork kéo Yakuza tới. Họ đề nghị bảo kê khu phố.'},
    bulk:{title:'Tập đoàn IT đặt hàng',copy:'Overclock Matcha kích hoạt đơn hàng số lượng lớn trong thời hạn ngắn.'},
    arena:{title:'Đấu sĩ Cyborg',copy:'Một võ sĩ vừa rời võ đài ghé quán để nạp năng lượng.'},
    matrix:{title:'Glitch in the Matrix',copy:'Mười giây trong quán lặp lại ba lần. Thu nhập trong vòng lặp được nhân ba.'}
  }
});
