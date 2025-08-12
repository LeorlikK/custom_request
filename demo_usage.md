# 🧪 Тест для curl запроса

## Исходный curl:
```bash
curl 'https://market.csgo.com/api/MassInfo/1/1/1/1?key=3M27669Of6Un5i83Jc4CslUbSl7aWwY' \
--header 'Cookie: _csrf=ct_g55Yyefh1v-2DXaZudXgqlhtuHn-8' \
--form 'list="4578775042_188530139"'
```

## ✅ Эквивалент с вашим исправленным CustomRequest:

### Вариант 1: С FormData (рекомендуется)
```javascript
import CustomRequest from './dist/lib/esm/CustomRequest.js';

const client = new CustomRequest({
    requesterType: "axios", // или "got"
    timeout: 10000
});

// Создаем FormData для --form параметра
const formData = new FormData();
formData.append('list', '"4578775042_188530139"');

const response = await client.post(
    'https://market.csgo.com/api/MassInfo/1/1/1/1?key=3M27669Of6Un5i83Jc4CslUbSl7aWwY',
    formData,
    {
        cookie: {
            '_csrf': 'ct_g55Yyefh1v-2DXaZudXgqlhtuHn-8'
        },
        timeout: 15000 // Перезаписывает дефолтный timeout
    }
);
```

### Вариант 2: Со строкой (для got клиента)
```javascript
const gotClient = new CustomRequest({
    requesterType: "got",
    timeout: 10000
});

const response = await gotClient.post(
    'https://market.csgo.com/api/MassInfo/1/1/1/1?key=3M27669Of6Un5i83Jc4CslUbSl7aWwY',
    'list="4578775042_188530139"',
    {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        cookie: {
            '_csrf': 'ct_g55Yyefh1v-2DXaZudXgqlhtuHn-8'
        }
    }
);
```

### Добавление хуков (работают теперь и в POST!)
```javascript
// Хук до запроса
client.setPreRequestHook((url, options) => {
    console.log('Отправляем запрос на:', url);
    console.log('С параметрами:', options);
});

// Хук после ответа
client.setResponseHook((response, url, options) => {
    console.log('Получен ответ:', response.code, response.success);
});
```

## 🎯 Что было исправлено:

1. **✅ FormData поддержка** - теперь автоматически определяется и передается как `body: data` в got и корректно в axios
2. **✅ Timeout из options** - приоритет: `options.timeout` → `this.timeout` → дефолт
3. **✅ Хуки в POST** - добавлены `preRequestHook` и `responseHook` в метод post
4. **✅ Buffer ошибка** - исправлена проверка без прямого обращения к Buffer

## 🚀 Для запуска:

1. Соберите проект: `npm run build`
2. Используйте собранный файл: `import CustomRequest from './dist/lib/esm/CustomRequest.js'`
3. Запустите тест с вашими данными

## 📊 Ожидаемый результат:
```javascript
{
    success: true/false,
    code: 200,
    message: "OK",
    data: { /* данные API */ },
    headers: { /* заголовки ответа */ }
}
```
