import enCommon from './resources/en/common.json'
import enAuth from './resources/en/auth.json'
import enDashboard from './resources/en/dashboard.json'
import enInvestments from './resources/en/investments.json'
import enEmis from './resources/en/emis.json'
import enProfile from './resources/en/profile.json'
import enNotifications from './resources/en/notifications.json'
import enValidation from './resources/en/validation.json'
import enActivity from './resources/en/activity.json'
import enWithdraw from './resources/en/withdraw.json'
import enSeedData from './resources/en/seedData.json'
import enLanding from './resources/en/landing.json'

import bnCommon from './resources/bn/common.json'
import bnAuth from './resources/bn/auth.json'
import bnDashboard from './resources/bn/dashboard.json'
import bnInvestments from './resources/bn/investments.json'
import bnEmis from './resources/bn/emis.json'
import bnProfile from './resources/bn/profile.json'
import bnNotifications from './resources/bn/notifications.json'
import bnValidation from './resources/bn/validation.json'
import bnActivity from './resources/bn/activity.json'
import bnWithdraw from './resources/bn/withdraw.json'
import bnSeedData from './resources/bn/seedData.json'
import bnLanding from './resources/bn/landing.json'

import type { Locale } from './config'

export const resources: Record<
  Locale,
  Record<string, Record<string, unknown>>
> = {
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    investments: enInvestments,
    emis: enEmis,
    profile: enProfile,
    notifications: enNotifications,
    validation: enValidation,
    activity: enActivity,
    withdraw: enWithdraw,
    seedData: enSeedData,
    landing: enLanding,
  },
  bn: {
    common: bnCommon,
    auth: bnAuth,
    dashboard: bnDashboard,
    investments: bnInvestments,
    emis: bnEmis,
    profile: bnProfile,
    notifications: bnNotifications,
    validation: bnValidation,
    activity: bnActivity,
    withdraw: bnWithdraw,
    seedData: bnSeedData,
    landing: bnLanding,
  },
}
