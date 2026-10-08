const WXAPI = require('apifm-wxapi')

Page({
  data: {
    loading: true,
    list: []
  },
  onShow() {
    this.loadDevices()
  },
  onPullDownRefresh() {
    this.loadDevices().then(() => wx.stopPullDownRefresh())
  },
  async loadDevices() {
    const token = wx.getStorageSync('token')
    if (!token) {
      this.setData({ loading: false, list: [] })
      return
    }
    const res = await WXAPI.userLogedList(token)
    if (res.code != 0) {
      this.setData({ loading: false })
      wx.showToast({ title: res.msg || '加载失败', icon: 'none' })
      return
    }
    const list = (res.data || []).map(item => ({
      ...item,
      isCurrent: item.token == token,
      ipAddress: '查询中...'
    }))
    // 当前登录设备排在最前面
    list.sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0))
    this.setData({ loading: false, list })
    this.loadIpAddress(list)
  },
  // 逐个查询 IP 归属地（相同 IP 只查询一次）
  async loadIpAddress(list) {
    const cache = {}
    for (let i = 0; i < list.length; i++) {
      const ip = list[i].loginIp
      if (!ip) {
        this.setData({ [`list[${i}].ipAddress`]: '未知' })
        continue
      }
      if (!cache[ip]) {
        cache[ip] = WXAPI.commonIPV3(ip).then(r => {
          return r.code == 0 && r.data && r.data.address
            ? String(r.data.address).replace(/\t/g, ' ')
            : '未知'
        }).catch(() => '未知')
      }
      const address = await cache[ip]
      this.setData({ [`list[${i}].ipAddress`]: address })
    }
  },
  kick(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.list[index]
    if (!item || item.isCurrent) {
      return
    }
    wx.showModal({
      title: '提示',
      content: '确定要将该设备退出登录吗？',
      confirmColor: '#ff4d4f',
      success: async res => {
        if (!res.confirm) {
          return
        }
        wx.showLoading({ title: '处理中' })
        const r = await WXAPI.loginout(item.token)
        wx.hideLoading()
        if (r.code != 0) {
          wx.showToast({ title: r.msg || '操作失败', icon: 'none' })
          return
        }
        wx.showToast({ title: '已退出该设备', icon: 'success' })
        const list = this.data.list.filter((_, i) => i != index)
        this.setData({ list })
      }
    })
  }
})
