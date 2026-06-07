'use client'

import { AdSlot } from '@/components/GoogleAdsense'
import replaceSearchResult from '@/components/Mark'
import NotionPage from '@/components/NotionPage'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { isBrowser } from '@/lib/utils'
import { Transition } from '@headlessui/react'
import dynamic from 'next/dynamic'
import SmartLink from '@/components/SmartLink'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Briefcase,
  ChevronRight,
  FileText,
  Globe,
  Globe2,
  Layers3,
  Library,
  Lightbulb,
  Map,
  Menu,
  Mic,
  Music2,
  Sparkles,
  Star,
  UserCircle,
  Volume2
} from 'lucide-react'
import BlogPostBar from './components/BlogPostBar'
import CONFIG from './config'
import { Style } from './style'

// --- 动态导入组件 ---
const AlgoliaSearchModal = dynamic(() => import('@/components/AlgoliaSearchModal'), {
  ssr: false,
  loading: () => <div className='p-4 text-center text-slate-500 animate-pulse'>加载中...</div>
})
const BookLibrary = dynamic(() => import('@/components/BookLibrary'), {
  ssr: false,
  loading: () => <div className='p-4 text-center text-slate-500 animate-pulse'>加载中...</div>
})
const AIChatDrawer = dynamic(() => import('@/components/AIChatDrawer'), {
  ssr: false,
  loading: () => <div className='p-4 text-center text-slate-500 animate-pulse'>加载中...</div>
})
const VoiceChat = dynamic(() => import('@/components/VoiceChat'), {
  ssr: false,
  loading: () => <div className='p-4 text-center text-slate-500 animate-pulse'>加载中...</div>
})

const BlogListScroll = dynamic(() => import('./components/BlogListScroll'), { ssr: false })
const BlogArchiveItem = dynamic(() => import('./components/BlogArchiveItem'), { ssr: false })
const ArticleLock = dynamic(() => import('./components/ArticleLock'), { ssr: false })
const ArticleInfo = dynamic(() => import('./components/ArticleInfo'), { ssr: false })
const Comment = dynamic(() => import('@/components/Comment'), { ssr: false })
const ArticleAround = dynamic(() => import('./components/ArticleAround'), { ssr: false })
const ShareBar = dynamic(() => import('@/components/ShareBar'), { ssr: false })
const TopBar = dynamic(() => import('./components/TopBar'), { ssr: false })
const Header = dynamic(() => import('./components/Header'), { ssr: false })
const NavBar = dynamic(() => import('./components/NavBar'), { ssr: false })
const SideBar = dynamic(() => import('./components/SideBar'), { ssr: false })
const JumpToTopButton = dynamic(() => import('./components/JumpToTopButton'), { ssr: false })
const Footer = dynamic(() => import('./components/Footer'), { ssr: false })
const SearchInput = dynamic(() => import('./components/SearchInput'), { ssr: false })
const WWAds = dynamic(() => import('@/components/WWAds'), { ssr: false })
const BlogListPage = dynamic(() => import('./components/BlogListPage'), { ssr: false })
const RecommendPosts = dynamic(() => import('./components/RecommendPosts'), { ssr: false })

const ThemeGlobalSimple = createContext()
export const useSimpleGlobal = () => useContext(ThemeGlobalSimple)

const BBS_BASE_URL = 'https://bbs.886.best'
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'

// 图片骨架屏占位 Base64
const blurDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mN88B8AAsUB4ZtvwVQAAAAASUVORK5CYII='

function useNodeBBAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function syncNodeBBUser() {
      try {
        const res = await fetch('/api/me', {
          signal: controller.signal,
          credentials: 'include',
          headers: { Accept: 'application/json' }
        })

        if (!res.ok) {
          setUser(null)
          return
        }

        const data = await res.json()
        if (data?.uid) {
          setUser({
            username: data.username,
            avatar: data.picture || DEFAULT_AVATAR
          })
        } else {
          setUser(null)
        }
      } catch (error) {
        if (error?.name !== 'AbortError') setUser(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    syncNodeBBUser()
    return () => controller.abort()
  }, [])

  return { user, loading }
}

const pinyinNav = [
  { zh: '声母', mm: 'ဗျည်း', icon: Mic, href: '/pinyin/initials', bg: 'bg-blue-100/80', color: 'text-blue-700' },
  { zh: '韵母', mm: 'သရ', icon: Music2, href: '/pinyin/finals', bg: 'bg-emerald-100/80', color: 'text-emerald-700' },
  { zh: '整体', mm: 'အသံတွဲ', icon: Layers3, href: '/pinyin/whole', bg: 'bg-purple-100/80', color: 'text-purple-700' },
  { zh: '声调', mm: 'အသံ', icon: FileText, href: '/pinyin/tones', bg: 'bg-orange-100/80', color: 'text-orange-700' }
]

const coreTools = [
  { zh: 'AI 翻译', mm: 'AI ဘာသာပြန်', icon: Globe, action: 'translator', bg: 'bg-indigo-100/80', iconColor: 'text-indigo-600' },
  { zh: '免费书籍', mm: 'စာကြည့်တိုက်', icon: Library, action: 'library', bg: 'bg-cyan-100/80', iconColor: 'text-cyan-600' },
  { zh: '单词收藏', mm: 'မှတ်ထားသော စာလုံး', icon: Star, href: '/words', bg: 'bg-amber-100/80', iconColor: 'text-amber-600' },
  { zh: '口语收藏', mm: 'မှတ်ထားသော စကားပြော', icon: Volume2, href: '/oral', bg: 'bg-rose-100/80', iconColor: 'text-rose-600' }
]

const systemCourses = [
  {
    badge: 'Words',
    sub: '词汇 (VOCABULARY)',
    title: '日常高频词汇',
    mmDesc: 'အခြေခံ စကားလုံးများကို လေ့လာပါ။',
    bgImg: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=1200',
    href: '/vocabulary',
    color: 'from-blue-700/90 via-blue-600/70'
  },
  {
    badge: 'Oral',
    sub: '短句 (ORAL)',
    title: '场景口语短句',
    mmDesc: 'အခြေအနေလိုက် စကားပြော လေ့ကျင့်မှု',
    bgImg: 'https://images.unsplash.com/photo-1528712306091-ed0763094c98?auto=format&fit=crop&q=80&w=1200',
    href: '/oral',
    color: 'from-emerald-700/90 via-emerald-600/70'
  },
  {
    badge: 'HSK 1',
    sub: '入门 (INTRO)',
    title: 'HSK Level 1',
    mmDesc: 'အသုံးအများဆုံး စကားလုံးများနှင့် သဒ္ဒါ',
    bgImg: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&q=80&w=1200',
    href: '/course/hsk1',
    color: 'from-indigo-700/90 via-indigo-600/70'
  }
]

const learningRoutes = ['/', '/vocabulary', '/pinyin', '/course', '/oral', '/learn']

function getLoginUrl() {
  if (typeof window === 'undefined') return `${BBS_BASE_URL}/login`
  return `${BBS_BASE_URL}/login?next=${encodeURIComponent(window.location.href)}`
}

const LayoutLearningHome = () => {
  const [activeOverlay, setActiveOverlay] = useState(null)
  const { user, loading: authLoading } = useNodeBBAuth()

  const [loginUrl, setLoginUrl] = useState(`${BBS_BASE_URL}/login`)

  useEffect(() => {
    setLoginUrl(getLoginUrl())
  }, [])

  const openOverlay = useCallback((overlayType) => {
    setActiveOverlay((prev) => {
      if (prev === overlayType) return prev
      if (typeof window !== 'undefined') {
        window.history.pushState({ overlay: overlayType }, '', window.location.href)
      }
      return overlayType
    })
  }, [])

  const closeOverlay = useCallback(() => {
    if (typeof window !== 'undefined' && activeOverlay) {
      window.history.back()
      return
    }
    setActiveOverlay(null)
  }, [activeOverlay])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onPopState = () => setActiveOverlay(null)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // 移动端左侧边缘右滑呼出菜单
  useEffect(() => {
    if (typeof window === 'undefined' || !('ontouchstart' in window) || activeOverlay) return undefined

    let startX = 0
    let startY = 0

    const handleTouchStart = (event) => {
      const touch = event.touches[0]
      startX = touch.clientX
      startY = touch.clientY
    }

    const handleTouchEnd = (event) => {
      const touch = event.changedTouches[0]
      const deltaX = touch.clientX - startX
      const deltaY = Math.abs(touch.clientY - startY)

      if (startX < 28 && deltaX > 56 && deltaY < 60) {
        openOverlay('menu')
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [activeOverlay, openOverlay])

  // 锁定背景滚动，避免弹窗滚动穿透
  useEffect(() => {
    if (typeof document === 'undefined' || !activeOverlay) return undefined
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [activeOverlay])

  const glassCard = 'rounded-[1.4rem] border border-white/70 bg-white/60 shadow-lg shadow-slate-200/40 backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-xl hover:shadow-slate-300/40 active:scale-95'
  const glassPanel = 'rounded-[2rem] border border-white/70 bg-white/55 shadow-xl shadow-slate-200/40 backdrop-blur-2xl'
  const menuItem = 'flex w-full items-center gap-3 rounded-2xl border border-white/70 bg-white/60 p-4 text-left font-bold text-slate-800 shadow-sm shadow-slate-200/40 backdrop-blur-xl transition-all hover:bg-white/80 active:scale-[0.98]'

  return (
    <main className='relative min-h-[100dvh] overflow-x-hidden text-slate-900'>
      {/* 浅色渐变背景 */}
      <div className='fixed inset-0 -z-30 bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.9),transparent_34%),radial-gradient(circle_at_top_right,rgba(221,214,254,0.85),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#eef6ff_44%,#f7f8ff_100%)]' />
      <div className='pointer-events-none fixed inset-0 -z-20 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),rgba(255,255,255,0.18))]' />
      <div className='pointer-events-none fixed -left-24 top-28 -z-10 h-64 w-64 rounded-full bg-cyan-200/35 blur-3xl' />
      <div className='pointer-events-none fixed -right-24 top-20 -z-10 h-72 w-72 rounded-full bg-indigo-200/35 blur-3xl' />
      <div className='pointer-events-none fixed bottom-0 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-100/45 blur-3xl' />

      {/* 侧边栏 */}
      <AnimatePresence>
        {activeOverlay === 'menu' && (
          <div className='fixed inset-0 z-[160] flex'>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeOverlay}
              className='absolute inset-0 bg-slate-900/25 backdrop-blur-md'
              aria-label='关闭侧边栏'
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              drag='x'
              dragConstraints={{ left: -220, right: 0 }}
              dragElastic={0.16}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80 || info.velocity.x < -400) closeOverlay()
              }}
              className='relative flex h-full w-72 flex-col border-r border-white/60 bg-white/70 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl'
            >
              <div className='absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.72),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.75),rgba(255,255,255,0.42))]' />

              <div className='p-5'>
                <div className={`${glassPanel} p-4`}>
                  <div className='flex items-center gap-3'>
                    {user ? (
                      <Image
                        src={user.avatar}
                        width={44}
                        height={44}
                        unoptimized
                        alt='avatar'
                        className='rounded-full border border-white/80 object-cover shadow-sm'
                      />
                    ) : (
                      <div className='flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/65 text-slate-400 shadow-sm'>
                        <UserCircle />
                      </div>
                    )}
                    <div className='min-w-0'>
                      <h2 className='truncate text-lg font-black text-slate-900'>{user ? user.username : '未登录'}</h2>
                      <p className='text-[10px] font-semibold uppercase tracking-widest text-slate-500'>中缅学习中心</p>
                    </div>
                  </div>
                </div>
              </div>

              <nav className='flex-1 space-y-2 overflow-y-auto px-5 pb-5'>
                <Link href='/' className={menuItem}>
                  <BookOpen size={20} />
                  首页
                </Link>
                <Link href='/course/hsk1' className={menuItem}>
                  <FileText size={20} />
                  HSK 课程
                </Link>
                <button type='button' onClick={() => openOverlay('library')} className={menuItem}>
                  <Library size={20} />
                  书籍库
                </button>
                <Link href={`${BBS_BASE_URL}/category/9/%E6%8B%9B%E8%81%98`} className={menuItem}>
                  <Briefcase size={20} />
                  招聘版块
                </Link>
              </nav>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className='relative z-10 mx-auto w-full max-w-md px-4 pb-10 pt-6'>
        {/* 顶部 */}
        <header className={`${glassPanel} mb-5 flex items-center justify-between px-4 py-3`}>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={() => openOverlay('menu')}
              aria-label='打开菜单'
              className='flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/55 text-slate-800 shadow-sm shadow-slate-200/40 backdrop-blur-xl transition-transform active:scale-90'
            >
              <Menu className='h-7 w-7' />
            </button>
            <div>
              <h1 className='text-xl font-black leading-none text-slate-900'>中缅文学习中心</h1>
              <div className='mt-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-600'>
                <Sparkles size={12} className='text-blue-500' />
                <span>Premium Hub</span>
              </div>
            </div>
          </div>

          <div className='flex items-center'>
            {authLoading ? (
              <div className='h-9 w-9 animate-pulse rounded-full bg-white/70' aria-label='加载状态' />
            ) : user ? (
              <Link href={`${BBS_BASE_URL}/user/${encodeURIComponent(user.username)}`} aria-label='用户中心'>
                <Image
                  src={user.avatar}
                  width={36}
                  height={36}
                  unoptimized
                  className='rounded-full border-2 border-white/90 object-cover shadow-md shadow-indigo-200/60'
                  alt='User'
                />
              </Link>
            ) : (
              <Link
                href={loginUrl}
                className='rounded-full border border-indigo-100/80 bg-white/65 px-3 py-1.5 text-sm font-bold text-indigo-600 shadow-sm shadow-indigo-100/50 backdrop-blur-xl transition-transform active:scale-95'
              >
                登录
              </Link>
            )}
          </div>
        </header>

        {/* 拼音导航 */}
        <section className='grid grid-cols-4 gap-3'>
          {pinyinNav.map((item) => (
            <Link key={item.zh} href={item.href} className={`${glassCard} flex flex-col items-center py-4`}>
              <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full ${item.bg}`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className='text-[13px] font-black text-slate-800'>{item.zh}</p>
              <p className='mt-0.5 text-[9px] font-medium text-slate-700'>{item.mm}</p>
            </Link>
          ))}
        </section>

        {/* 核心工具 */}
        <section className='mt-4 grid grid-cols-2 gap-3'>
          {coreTools.map((tool) => {
            const content = (
              <div className='flex items-center gap-3'>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tool.bg} ${tool.iconColor}`}>
                  <tool.icon size={20} />
                </div>
                <div className='min-w-0'>
                  <p className='truncate text-[13px] font-black text-slate-800'>{tool.zh}</p>
                  <p className='truncate text-[9px] text-slate-700'>{tool.mm}</p>
                </div>
              </div>
            )

            return tool.action ? (
              <button key={tool.zh} type='button' onClick={() => openOverlay(tool.action)} className={`${glassCard} p-3.5 text-left`}>
                {content}
              </button>
            ) : (
              <Link key={tool.zh} href={tool.href} className={`${glassCard} p-3.5`}>
                {content}
              </Link>
            )
          })}
        </section>

        {/* 发音技巧 */}
        <section className='mt-4'>
          <Link href='/pinyin/tips' className={`${glassCard} flex items-center justify-between p-4`}>
            <div className='flex items-center gap-4'>
              <div className='rounded-2xl bg-orange-100/80 p-2 text-orange-700'>
                <Lightbulb size={20} />
              </div>
              <div>
                <p className='text-[14px] font-black text-slate-800'>发音技巧 (Tips)</p>
                <p className='text-[10px] text-slate-700'>အသံထွက်နည်းလမ်းများ</p>
              </div>
            </div>
            <ChevronRight className='h-5 w-5 text-slate-400' />
          </Link>
        </section>

        {/* AI 真人私教对练 */}
        <section className='mb-2 mt-8'>
          <button
            type='button'
            onClick={() => openOverlay('ai-tutor')}
            className='group relative h-[140px] w-full overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/50 text-left shadow-xl shadow-slate-200/50 backdrop-blur-2xl transition-all active:scale-95'
          >
            <Image
              src='https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&q=80&w=1200'
              alt='AI 真人私教对练'
              fill
              sizes='(max-width: 768px) 100vw, 400px'
              placeholder='blur'
              blurDataURL={blurDataURL}
              className='object-cover transition-transform duration-700 group-hover:scale-105'
            />
            <div className='absolute inset-0 bg-gradient-to-r from-slate-900/82 via-slate-900/42 to-white/10' />
            <div className='relative z-10 flex h-full flex-col justify-center px-6'>
              <div className='mb-2 flex items-center gap-1.5'>
                <span className='rounded-full border border-white/25 bg-pink-500/95 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-white shadow-sm'>AI TUTOR</span>
                <Sparkles size={14} className='animate-pulse text-pink-200' />
              </div>
              <h3 className='text-xl font-black text-white drop-shadow-md'>AI 真人私教对练</h3>
              <p className='mt-1 text-xs font-medium text-white/95 drop-shadow-sm'>沉浸式真实口语对话</p>
            </div>
          </button>
        </section>

        {/* 主线闯关地图 */}
        <section className='mt-4'>
          <Link href='/learn' className={`${glassCard} relative flex items-center gap-4 overflow-hidden border-l-[6px] border-l-green-500 p-5`}>
            <div className='absolute -right-6 -top-6 h-24 w-24 rounded-full bg-green-500/10 blur-2xl' />
            <div className='relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 text-white shadow-lg shadow-green-200 transition-transform active:scale-110'>
              <Map size={26} />
            </div>
            <div className='relative flex-1'>
              <div className='flex items-center gap-2'>
                <h3 className='text-lg font-black uppercase leading-tight text-slate-900'>主线闯关地图</h3>
                <span className='animate-pulse rounded bg-green-500 px-1.5 py-0.5 text-[9px] font-black text-white'>NEW</span>
              </div>
              <p className='mt-0.5 text-[13px] font-bold text-slate-600'>စနစ်တကျ လေ့လာရန် လမ်းပြမြေပုံ</p>
              <div className='mt-3 flex items-center gap-2'>
                <div className='h-1.5 w-full max-w-[110px] overflow-hidden rounded-full bg-white/70'>
                  <div className='h-full w-2/5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' />
                </div>
                <span className='text-[9px] font-black tracking-tighter text-green-600 opacity-70'>CONTINUE</span>
              </div>
            </div>
            <ChevronRight className='h-5 w-5 shrink-0 text-slate-300' />
          </Link>
        </section>

        {/* 系统课程 */}
        <section className='mt-8'>
          <div className='mb-4 flex items-center gap-2 px-1'>
            <BookOpen className='h-4 w-4 text-slate-400' />
            <h2 className='text-[11px] font-black uppercase tracking-[0.2em] text-slate-500'>SYSTEM COURSES</h2>
          </div>
          <div className='flex flex-col gap-4'>
            {systemCourses.map((course) => (
              <Link key={course.title} href={course.href} className='group relative h-40 overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/55 shadow-lg shadow-slate-200/50 backdrop-blur-2xl transition-all active:scale-[0.98]'>
                <Image
                  src={course.bgImg}
                  alt={course.title}
                  fill
                  sizes='(max-width: 768px) 100vw, 400px'
                  placeholder='blur'
                  blurDataURL={blurDataURL}
                  loading='lazy'
                  className='object-cover transition-transform duration-700 group-hover:scale-105'
                />
                <div className={`absolute inset-0 bg-gradient-to-r ${course.color} to-transparent`} />
                <div className='relative flex h-full flex-col justify-center px-8'>
                  <span className='mb-2 w-fit rounded-lg border border-white/30 bg-white/25 px-2 py-0.5 text-[9px] font-black uppercase text-white backdrop-blur-md'>
                    {course.badge}
                  </span>
                  <p className='mb-1 text-[10px] font-bold uppercase tracking-widest text-white/80'>{course.sub}</p>
                  <h3 className='text-2xl font-black text-white drop-shadow-md'>{course.title}</h3>
                  <p className='mt-1 text-xs font-medium text-white/95 drop-shadow-sm'>{course.mmDesc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* 所有全屏弹窗统一挂载在此 */}
      <AnimatePresence>
        {activeOverlay === 'translator' && (
          <div className='fixed inset-0 z-[150]'>
            <AIChatDrawer isOpen onClose={closeOverlay} />
          </div>
        )}
        {activeOverlay === 'ai-tutor' && (
          <div className='fixed inset-0 z-[150]'>
            <VoiceChat isOpen onClose={closeOverlay} />
          </div>
        )}
        {activeOverlay === 'library' && (
          <div className='fixed inset-0 z-[150]'>
            <BookLibrary isOpen onClose={closeOverlay} />
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}

// ===================== 基础布局框架 =====================
const LayoutBase = (props) => {
  const { children, slotTop } = props
  const { onLoading, fullWidth } = useGlobal()
  const searchModal = useRef(null)
  const router = useRouter()
  const pathname = router?.pathname || ''

  const isLearningRoute = learningRoutes.some((route) => {
    if (route === '/') return pathname === '/'
    return pathname.startsWith(route)
  })

  if (isLearningRoute) {
    return (
      <ThemeGlobalSimple.Provider value={{ searchModal }}>
        <div id='theme-simple' className={`${siteConfig('FONT_STYLE')} min-h-screen`}>
          <Style />
          {children}
        </div>
      </ThemeGlobalSimple.Provider>
    )
  }

  return (
    <ThemeGlobalSimple.Provider value={{ searchModal }}>
      <div id='theme-simple' className={`${siteConfig('FONT_STYLE')} min-h-screen flex flex-col bg-white dark:bg-black scroll-smooth`}>
        <Style />
        {siteConfig('SIMPLE_TOP_BAR', null, CONFIG) && <TopBar {...props} />}
        <Header {...props} />
        <NavBar {...props} />
        <div id='container-wrapper' className={`${JSON.parse(siteConfig('LAYOUT_SIDEBAR_REVERSE')) ? 'flex-row-reverse' : ''} w-full flex-1 flex items-start max-w-9/10 mx-auto pt-12`}>
          <div id='container-inner' className='min-h-fit w-full flex-grow'>
            <Transition show={!onLoading} appear enter='transition duration-700' enterFrom='opacity-0 translate-y-16' enterTo='opacity-100 translate-y-0'>
              {slotTop}
              {children}
            </Transition>
            <AdSlot type='native' />
          </div>
          {!fullWidth && (
            <div id='right-sidebar' className='sticky top-8 hidden w-96 flex-none border-l border-gray-100 pl-12 xl:block'>
              <SideBar {...props} />
            </div>
          )}
        </div>
        <div className='fixed bottom-4 right-4 z-20'>
          <JumpToTopButton />
        </div>
        <AlgoliaSearchModal cRef={searchModal} {...props} />
        <Footer {...props} />
      </div>
    </ThemeGlobalSimple.Provider>
  )
}

const LayoutIndex = (props) => <LayoutLearningHome {...props} />

const LayoutPostList = (props) => (
  <>
    <BlogPostBar {...props} />
    {siteConfig('POST_LIST_STYLE') === 'page'
      ? <BlogListPage {...props} />
      : <BlogListScroll {...props} />}
  </>
)

const LayoutSearch = (props) => {
  const { keyword } = props

  useEffect(() => {
    if (isBrowser) {
      replaceSearchResult({
        doms: document.getElementById('posts-wrapper'),
        search: keyword,
        target: { element: 'span', className: 'text-red-500' }
      })
    }
  }, [keyword])

  return <LayoutPostList {...props} slotTop={siteConfig('ALGOLIA_APP_ID') ? null : <SearchInput {...props} />} />
}

const LayoutArchive = (props) => (
  <div className='mb-10 min-h-screen w-full p-3 pb-20 md:py-12'>
    {Object.keys(props.archivePosts).map((archiveTitle) => (
      <BlogArchiveItem key={archiveTitle} archiveTitle={archiveTitle} archivePosts={props.archivePosts} />
    ))}
  </div>
)

const LayoutSlug = (props) => {
  const { post, lock, validPassword, prev, next, recommendPosts } = props
  const { fullWidth } = useGlobal()

  return (
    <>
      {lock && <ArticleLock validPassword={validPassword} />}
      {!lock && post && (
        <div className={`px-2 ${fullWidth ? '' : 'xl:max-w-4xl 2xl:max-w-6xl'}`}>
          <ArticleInfo post={post} />
          <WWAds orientation='horizontal' className='w-full' />
          <div id='article-wrapper'>{!lock && <NotionPage post={post} />}</div>
          <ShareBar post={post} />
          <AdSlot type='in-article' />
          {post?.type === 'Post' && (
            <>
              <ArticleAround prev={prev} next={next} />
              <RecommendPosts recommendPosts={recommendPosts} />
            </>
          )}
          <Comment frontMatter={post} />
        </div>
      )}
    </>
  )
}

const Layout404 = () => <>404 Not found.</>

const LayoutCategoryIndex = (props) => (
  <div id='category-list' className='flex flex-wrap duration-200'>
    {props.categoryOptions?.map((category) => (
      <SmartLink key={category.name} href={`/category/${category.name}`} passHref legacyBehavior>
        <div className='cursor-pointer px-5 py-2 hover:bg-gray-100'>
          <i className='fas fa-folder mr-4' />
          {category.name}({category.count})
        </div>
      </SmartLink>
    ))}
  </div>
)

const LayoutTagIndex = (props) => (
  <div id='tags-list' className='flex flex-wrap duration-200'>
    {props.tagOptions.map((tag) => (
      <div key={tag.name} className='p-2'>
        <SmartLink
          href={`/tag/${encodeURIComponent(tag.name)}`}
          className={`notion-${tag.color}_background mr-2 inline-block cursor-pointer rounded px-2 py-1 text-xs duration-200 hover:bg-gray-500 hover:text-white`}
        >
          <div className='font-light'>
            <i className='fas fa-tag mr-1' /> {tag.name + (tag.count ? `(${tag.count})` : '')}
          </div>
        </SmartLink>
      </div>
    ))}
  </div>
)

export {
  Layout404,
  LayoutArchive,
  LayoutBase,
  LayoutCategoryIndex,
  LayoutIndex,
  LayoutPostList,
  LayoutSearch,
  LayoutSlug,
  LayoutTagIndex,
  CONFIG as THEME_CONFIG
}
