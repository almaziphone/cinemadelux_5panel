import { createRouter, createWebHistory } from 'vue-router'
import BoardView from '../views/BoardView.vue'
import AdminView from '../views/AdminView.vue'
import LoginView from '../views/LoginView.vue'
import { checkAuth } from '../api/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/board',
      name: 'board',
      component: BoardView
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiresAuth: true }
    },
    {
      path: '/admin/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/',
      redirect: '/board'
    }
  ]
})

router.beforeEach(async (to, _from, next) => {
  // Пропускаем проверку, если переходим на страницу логина
  if (to.path === '/admin/login') {
    next()
    return
  }
  
  if (to.meta.requiresAuth) {
    const isAuthenticated = await checkAuth()
    if (!isAuthenticated) {
      next('/admin/login')
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router
