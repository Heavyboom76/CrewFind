import { initAuth } from './js/auth.js'
import { initListings, renderListings } from './js/listings.js'
import { initPost } from './js/post.js'
import { initShipSearch } from './js/ships.js'
import { setTabById, openExternalUrl } from './js/ui.js'
import { registerWithEmail, loginWithEmail, signInWithDiscord, signOut, saveHandle, setOnboardView, resetPassword, setNewPassword, deleteAccount } from './js/auth.js'

// Make functions available globally for inline HTML handlers
window.setTabById = setTabById
window.openExternalUrl = openExternalUrl
window.signInWithDiscord = signInWithDiscord
window.signOut = signOut
window.saveHandle = saveHandle
window.setOnboardView = setOnboardView
window.registerWithEmail = registerWithEmail
window.loginWithEmail = loginWithEmail
window.resetPassword = resetPassword
window.setNewPassword = setNewPassword
window.deleteAccount = deleteAccount

// Import and expose listing/post functions
import { filterBy, filterBySelect, onSearchInput, clearSearch, openApply, closeApplyModal, submitApply, deleteListing, bumpListing, renderMyPosts } from './js/listings.js'
window.filterBy = filterBy
window.filterBySelect = filterBySelect
window.onSearchInput = onSearchInput
window.clearSearch = clearSearch
window.openApply = openApply
window.closeApplyModal = closeApplyModal
window.submitApply = submitApply
window.deleteListing = deleteListing
window.bumpListing = bumpListing

import { openPostModal, closePostModal, submitPost, adjustRole, previewOrgPoster, setPostType } from './js/post.js'
window.openPostModal = openPostModal
window.closePostModal = closePostModal
window.submitPost = submitPost
window.adjustRole = adjustRole
window.previewOrgPoster = previewOrgPoster
window.setPostType = setPostType

import { selectShip } from './js/ships.js'
import { toggleInVerseStatus, changeHandle } from './js/listings.js'
import { initMessages, renderInbox, openChat, startConversation, sendMessage, clearConversation, blockUser, openMessagesTab, checkUnread } from './js/messages.js'
import { checkAdminStatus, openAdminPanel, reportButtonHtml, openReportModal, closeReportModal, submitReport, adminHide, adminUnhide, adminBanUser, adminDismissReport, adminAddAdmin, adminRemoveAdmin } from './js/admin.js'
import { openProfile, closeProfile, submitRating, saveProfileField, triggerAvatarUpload, uploadAvatar, toggleAddShip, addShipToHangar, removeShipFromHangar, copyToClipboard } from './js/profile.js'
window.selectShip = selectShip
window.toggleInVerseStatus = toggleInVerseStatus
window.changeHandle = changeHandle
window.openProfile = openProfile
window.closeProfile = closeProfile
window.submitRating = submitRating
window.saveProfileField = saveProfileField
window.triggerAvatarUpload = triggerAvatarUpload
window.uploadAvatar = uploadAvatar
window.toggleAddShip = toggleAddShip
window.addShipToHangar = addShipToHangar
window.removeShipFromHangar = removeShipFromHangar
window.copyToClipboard = copyToClipboard
window.openOwnProfile = () => { import('./js/auth.js').then(m => openProfile(m.getCurrentHandle())) }
window.openAdminPanel = openAdminPanel
window.reportButtonHtml = reportButtonHtml
window.openReportModal = openReportModal
window.closeReportModal = closeReportModal
window.submitReport = submitReport

// Re-export admin window functions already set in admin.js
// (adminHide, adminUnhide, adminBanUser etc are set via window.xxx in admin.js)
window.openChat = openChat
window.renderInbox = renderInbox
window.clearConversation = clearConversation
window.blockUser = blockUser

// PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => console.log('// SW: REGISTERED'))
      .catch(e => console.log('// SW: FAILED', e))
  })
}

// iOS install banner
;(function () {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = window.navigator.standalone === true
  const dismissed = localStorage.getItem('iosBannerDismissed')
  if (isIos && !isStandalone && !dismissed) {
    setTimeout(() => {
      const banner = document.getElementById('ios-install-banner')
      if (banner) banner.style.display = 'block'
    }, 3000)
  }
})()

// Init
initShipSearch()
await initAuth()
await initMessages()
await renderListings()
await checkAdminStatus()
setTimeout(checkUnread, 1500)

// Tab handlers — set up after everything is loaded
document.getElementById('tab-btn-browse')?.addEventListener('click', async function() {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'))
  this.classList.add('active')
  document.getElementById('tab-browse').style.display = 'block'
  document.getElementById('tab-my-posts').style.display = 'none'
  await renderListings()
})

document.getElementById('tab-btn-my-posts')?.addEventListener('click', async function() {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'))
  this.classList.add('active')
  document.getElementById('tab-browse').style.display = 'none'
  document.getElementById('tab-my-posts').style.display = 'block'
  await renderMyPosts()
})

document.dispatchEvent(new Event('crewfind:ready'))

// ── Messages module ───────────────────────────────────────────────────────────
