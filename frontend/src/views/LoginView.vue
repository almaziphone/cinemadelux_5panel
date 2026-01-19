<template>
  <div class="login-container">
    <div class="login-box">
      <h1>Вход в админ-панель</h1>
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>Логин</label>
          <input
            v-model="username"
            type="text"
            required
            autocomplete="username"
            placeholder="Введите логин"
          />
        </div>
        <div class="form-group">
          <label>Пароль</label>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="Введите пароль"
          />
        </div>
        <div v-if="error" class="error-message">{{ error }}</div>
        <button type="submit" :disabled="loading" class="login-button">
          {{ loading ? 'Вход...' : 'Войти' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../api/auth'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  error.value = ''
  loading.value = true
  
  try {
    await login(username.value, password.value)
    router.push('/admin')
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Ошибка входа'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.login-box {
  background: rgba(255, 255, 255, 0.95);
  padding: 60px;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 400px;
}

h1 {
  text-align: center;
  margin-bottom: 40px;
  color: #1a1a2e;
  font-size: 32px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

input {
  padding: 12px 16px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
}

input:focus {
  outline: none;
  border-color: #00d4ff;
}

.error-message {
  color: #d32f2f;
  font-size: 14px;
  text-align: center;
  padding: 12px;
  background: #ffebee;
  border-radius: 8px;
}

.login-button {
  padding: 14px;
  background: #00d4ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.login-button:hover:not(:disabled) {
  background: #00b8d4;
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
