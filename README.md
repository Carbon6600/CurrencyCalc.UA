# **CurrencyCalc.UA**  
**💵 Валютний калькулятор українських банків у стилі смартфона**  

<a href="https://carbon6600.github.io/CurrencyCalc.UA/" target="_blank" rel="noopener noreferrer">
  <img width="386" height="760" alt="Знімок екрана" 
       src="https://github.com/user-attachments/assets/919ce864-af2a-44e8-ba88-b94f50652660" />
</a>

### **🌐 Опис проекту**  
**CurrencyCalc.UA** — це сучасний веб-додаток для миттєвого порівняння актуальних курсів валют у топових українських банках. Завдяки інтеграції з хмарними сервісами, користувач отримує дані в реальному часі без затримок.

**Основні можливості:**
- 🔄 **Автоматичне оновлення:** Курси оновлюються у фоні кожні 15 хвилин.
- 📊 **Порівняння банків:** Актуальні дані від Monobank та ПриватБанку, а також статичні дані інших установ.
- 🔢 **Розумний калькулятор:** Можливість виконувати арифметичні операції прямо в полі вводу.
- ⚡ **Миттєвий відгук:** Використання локального кешу та Realtime Database для миттєвого відображення.

### **✨ Ключові переваги**  
| Особливість | Опис |
|------------|-------|
| **Real-time Sync** | Дані оновлюються на екрані автоматично без перезавантаження сторінки |
| **Edge Computing** | Використання Cloudflare Workers для обходу CORS та стабільного збору даних |
| **3 валюти** | Миттєве перемикання між гривнею, доларом та євро |
| **Стильний UI** | Дизайн у формі мобільного додатку з плавними анімаціями |

### **🛠 Архітектура системи**  
Проєкт реалізовано за схемою **Serverless Pipeline**:

`Bank APIs` $\rightarrow$ `Cloudflare Worker (Cron)` $\rightarrow$ `Firebase Realtime DB` $\rightarrow$ `Frontend (Client)`

1. **Cloudflare Worker:** Виконує роль бекенду. Раз на 15 хвилин опитує API банків, обробляє дані та записує їх у Firebase.
2. **Firebase RTDB:** Слугує центральним сховищем. Забезпечує миттєву доставку оновлень на всі пристрої користувачів.
3. **Frontend:** Легкий клієнт на Vanilla JS, який підписаний на зміни в базі даних та відображає їх у реальному часі.

### **⚙️ Технічний стек**  
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Cloudflare Workers (JavaScript/V8)
- **Database:** Firebase Realtime Database
- **Auth:** Firebase Anonymous Authentication

### **🚀 Інструкція з розгортання (для розробників)**  

#### 1. Налаштування Firebase
- Створити проєкт у Firebase Console.
- Активувати **Realtime Database** та **Anonymous Auth**.
- Встановити правила безпеки:
  ```json
  {
    "rules": {
      "exchangeRates": {
        ".read": true,
        "$date": {
          ".write": "auth != null",
          ".validate": "newData.hasChildren(['monobank', 'privatbank', 'timestamp'])"
        }
      }
    }
  }
  ```

#### 2. Налаштування Cloudflare Worker
- Створити Worker та додати змінні середовища:
  - `FIREBASE_DB_URL`: URL вашої бази даних.
  - `FIREBASE_SECRET`: Секретний ключ бази даних.
- Налаштувати **Cron Trigger** на `*/15 * * * *`.

### **📌 Майбутні оновлення**  
- [ ] Додавання нових банків (Ощадбанк, ПУМБ)  
- [ ] Графіки зміни курсів за тиждень/місяць  
- [ ] Push-сповіщення про значні зміни курсу  

```bash
# Для запуску локально:
open index.html
```

---
**GitHub:** [github.com/Carbon6600/CurrencyCalc.UA](https://github.com/Carbon6600/CurrencyCalc.UA)  
**Live Demo:** [carbon6600.github.io/CurrencyCalc.UA](https://carbon6600.github.io/CurrencyCalc.UA)  
**Ліцензія:** MIT  

*"Знайте актуальні курси - приймайте обґрунтовані фінансові рішення!"* 💰
