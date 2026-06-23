<script setup lang="ts">
// 是否能編輯器材室（需有 equipment 頁權限；超級管理員全通）
const canEdit = useCanEdit('equipment')
const toast = useToast()

const { data: equipment, refresh: refreshEquip } = await useFetch<Equipment[]>('/api/equipment')
const { data: rentals, refresh: refreshRentals } = await useFetch<Rental[]>('/api/rentals')

// 器材室只有中壢一間
const classroom = '中壢'
const viewTabs = [
  { label: '器材清單', icon: 'i-lucide-package', slot: 'list' as const },
  { label: '借還紀錄', icon: 'i-lucide-clipboard-list', slot: 'rentals' as const }
]

// 依教室篩選
const myEquip = computed(() => (equipment.value ?? []).filter(e => e.classroom === classroom))
const myRentals = computed(() => (rentals.value ?? []).filter(r => r.classroom === classroom))

// 某器材「借出中」數量 = 未歸還的借出加總
function borrowedOf(equipmentId: number) {
  return (rentals.value ?? [])
    .filter(r => r.equipmentId === equipmentId && !r.returnDate)
    .reduce((sum, r) => sum + r.qty, 0)
}
function availableOf(e: Equipment) {
  return e.totalQty - borrowedOf(e.id)
}

// 統計卡（目前教室）
const stats = computed(() => {
  const list = myEquip.value
  const total = list.reduce((s, e) => s + e.totalQty, 0)
  const borrowed = list.reduce((s, e) => s + borrowedOf(e.id), 0)
  return { kinds: list.length, total, borrowed, available: total - borrowed }
})

// 借出表單可選的器材
const equipItems = computed(() =>
  myEquip.value.map(e => ({ label: `${e.name}（可用 ${availableOf(e)}）`, value: e.id }))
)

/* ---------- 器材表單 ---------- */
const equipOpen = ref(false)
const equipEditingId = ref<number | null>(null)
const equipSaving = ref(false)
const equipForm = reactive({ name: '', category: '', totalQty: 1, note: '' })

function openCreateEquip() {
  equipEditingId.value = null
  Object.assign(equipForm, { name: '', category: '', totalQty: 1, note: '' })
  equipOpen.value = true
}
function openEditEquip(e: Equipment) {
  equipEditingId.value = e.id
  Object.assign(equipForm, { name: e.name, category: e.category ?? '', totalQty: e.totalQty, note: e.note ?? '' })
  equipOpen.value = true
}
async function saveEquip() {
  if (!equipForm.name.trim()) {
    toast.add({ title: '請輸入器材名稱', color: 'error' })
    return
  }
  equipSaving.value = true
  try {
    const body = { classroom, ...equipForm }
    if (equipEditingId.value === null) {
      await $fetch('/api/equipment', { method: 'POST', body })
    } else {
      await $fetch(`/api/equipment/${equipEditingId.value}`, { method: 'PUT', body })
    }
    toast.add({ title: '已儲存', color: 'success' })
    equipOpen.value = false
    await refreshEquip()
  } catch {
    toast.add({ title: '儲存失敗', color: 'error' })
  } finally {
    equipSaving.value = false
  }
}
async function removeEquip(e: Equipment) {
  if (!confirm(`確定刪除「${e.name}」？相關借還紀錄也會一併刪除。`)) return
  try {
    await $fetch(`/api/equipment/${e.id}`, { method: 'DELETE' })
    toast.add({ title: '已刪除', color: 'success' })
    await Promise.all([refreshEquip(), refreshRentals()])
  } catch {
    toast.add({ title: '刪除失敗', color: 'error' })
  }
}

/* ---------- 借還表單 ---------- */
const rentalOpen = ref(false)
const rentalEditingId = ref<number | null>(null)
const rentalSaving = ref(false)
const rentalForm = reactive({
  equipmentId: null as number | null,
  borrower: '',
  qty: 1,
  borrowDate: '',
  dueDate: '',
  note: ''
})

function openBorrow(e?: Equipment) {
  rentalEditingId.value = null
  Object.assign(rentalForm, {
    equipmentId: e?.id ?? (myEquip.value[0]?.id ?? null),
    borrower: '',
    qty: 1,
    borrowDate: todayStr(),
    dueDate: '',
    note: ''
  })
  rentalOpen.value = true
}
function openEditRental(r: Rental) {
  rentalEditingId.value = r.id
  Object.assign(rentalForm, {
    equipmentId: r.equipmentId,
    borrower: r.borrower,
    qty: r.qty,
    borrowDate: r.borrowDate,
    dueDate: r.dueDate ?? '',
    note: r.note ?? ''
  })
  rentalOpen.value = true
}
async function saveRental() {
  if (!rentalForm.equipmentId) {
    toast.add({ title: '請選擇器材', color: 'error' })
    return
  }
  rentalSaving.value = true
  try {
    if (rentalEditingId.value === null) {
      await $fetch('/api/rentals', { method: 'POST', body: rentalForm })
    } else {
      await $fetch(`/api/rentals/${rentalEditingId.value}`, { method: 'PUT', body: rentalForm })
    }
    toast.add({ title: '已儲存', color: 'success' })
    rentalOpen.value = false
    await refreshRentals()
  } catch (err: unknown) {
    const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
    toast.add({ title: '儲存失敗', description: msg, color: 'error' })
  } finally {
    rentalSaving.value = false
  }
}
async function returnRental(r: Rental) {
  try {
    await $fetch(`/api/rentals/${r.id}`, {
      method: 'PUT',
      body: {
        equipmentId: r.equipmentId,
        borrower: r.borrower,
        qty: r.qty,
        borrowDate: r.borrowDate,
        dueDate: r.dueDate ?? '',
        returnDate: todayStr(),
        note: r.note ?? ''
      }
    })
    toast.add({ title: '已歸還', color: 'success' })
    await refreshRentals()
  } catch {
    toast.add({ title: '歸還失敗', color: 'error' })
  }
}
async function removeRental(r: Rental) {
  if (!confirm('確定刪除這筆借還紀錄？')) return
  try {
    await $fetch(`/api/rentals/${r.id}`, { method: 'DELETE' })
    toast.add({ title: '已刪除', color: 'success' })
    await refreshRentals()
  } catch {
    toast.add({ title: '刪除失敗', color: 'error' })
  }
}
</script>

<template>
  <UContainer class="py-8">
    <h1 class="text-2xl font-bold mb-6">
      器材室管理
    </h1>

    <!-- 數量統計 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div class="border border-default rounded-lg p-4">
        <div class="text-sm text-muted">器材種類</div>
        <div class="text-2xl font-bold">{{ stats.kinds }}</div>
      </div>
      <div class="border border-default rounded-lg p-4">
        <div class="text-sm text-muted">總數量</div>
        <div class="text-2xl font-bold">{{ stats.total }}</div>
      </div>
      <div class="border border-default rounded-lg p-4">
        <div class="text-sm text-muted">借出中</div>
        <div class="text-2xl font-bold text-warning">{{ stats.borrowed }}</div>
      </div>
      <div class="border border-default rounded-lg p-4">
        <div class="text-sm text-muted">可用</div>
        <div class="text-2xl font-bold text-primary">{{ stats.available }}</div>
      </div>
    </div>

    <UTabs :items="viewTabs">
      <!-- 器材清單 -->
      <template #list>
        <div v-if="canEdit" class="flex justify-end gap-2 mb-4">
          <UButton icon="i-lucide-arrow-right-left" color="neutral" variant="subtle" @click="openBorrow()">
            借出
          </UButton>
          <UButton icon="i-lucide-plus" @click="openCreateEquip">
            新增器材
          </UButton>
        </div>

        <div v-if="!myEquip.length" class="text-muted text-center py-12">
          這個教室還沒有器材。
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="e in myEquip"
            :key="e.id"
            class="flex items-center gap-3 border border-default rounded-lg p-3"
          >
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate flex items-center gap-2">
                {{ e.name }}
                <UBadge v-if="e.category" color="neutral" variant="subtle">{{ e.category }}</UBadge>
              </div>
              <div v-if="e.note" class="text-sm text-muted truncate">{{ e.note }}</div>
            </div>
            <div class="flex items-center gap-4 text-sm tabular-nums shrink-0">
              <span class="text-muted">總 {{ e.totalQty }}</span>
              <span class="text-warning">借出 {{ borrowedOf(e.id) }}</span>
              <span class="font-medium" :class="availableOf(e) > 0 ? 'text-primary' : 'text-error'">
                可用 {{ availableOf(e) }}
              </span>
            </div>
            <template v-if="canEdit">
              <UButton
                icon="i-lucide-arrow-right-left"
                color="neutral"
                variant="ghost"
                :disabled="availableOf(e) <= 0"
                @click="openBorrow(e)"
              />
              <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" @click="openEditEquip(e)" />
              <UButton icon="i-lucide-trash-2" color="error" variant="ghost" @click="removeEquip(e)" />
            </template>
          </div>
        </div>
      </template>

      <!-- 借還紀錄 -->
      <template #rentals>
        <div v-if="canEdit" class="flex justify-end mb-4">
          <UButton icon="i-lucide-plus" :disabled="!myEquip.length" @click="openBorrow()">
            新增借出
          </UButton>
        </div>

        <div v-if="!myRentals.length" class="text-muted text-center py-12">
          還沒有借還紀錄。
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="r in myRentals"
            :key="r.id"
            class="flex items-center gap-3 border border-default rounded-lg p-3"
          >
            <UBadge :color="r.returnDate ? 'success' : 'warning'" variant="subtle" class="shrink-0">
              {{ r.returnDate ? '已歸還' : '借出中' }}
            </UBadge>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">
                {{ r.equipmentName }} × {{ r.qty }}
              </div>
              <div class="text-sm text-muted truncate">
                借用人：{{ r.borrower }}
              </div>
            </div>
            <div class="text-sm tabular-nums text-muted shrink-0 text-right">
              <div>借出 {{ r.borrowDate }}</div>
              <div v-if="r.returnDate">歸還 {{ r.returnDate }}</div>
              <div v-else-if="r.dueDate">應還 {{ r.dueDate }}</div>
            </div>
            <template v-if="canEdit">
              <UButton
                v-if="!r.returnDate"
                icon="i-lucide-check"
                color="success"
                variant="ghost"
                @click="returnRental(r)"
              >
                歸還
              </UButton>
              <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" @click="openEditRental(r)" />
              <UButton icon="i-lucide-trash-2" color="error" variant="ghost" @click="removeRental(r)" />
            </template>
          </div>
        </div>
      </template>
    </UTabs>

    <!-- 器材表單 -->
    <UModal v-model:open="equipOpen" :title="equipEditingId === null ? '新增器材' : '編輯器材'">
      <template #body>
        <div class="space-y-4">
          <UFormField label="器材名稱" required>
            <UInput v-model="equipForm.name" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="分類">
              <UInput v-model="equipForm.category" class="w-full" placeholder="例：球類、3C" />
            </UFormField>
            <UFormField label="總數量">
              <UInput v-model.number="equipForm.totalQty" type="number" min="0" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="備註">
            <UTextarea v-model="equipForm.note" class="w-full" :rows="2" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="equipOpen = false">取消</UButton>
            <UButton :loading="equipSaving" @click="saveEquip">儲存</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 借還表單 -->
    <UModal v-model:open="rentalOpen" :title="rentalEditingId === null ? '新增借出' : '編輯借還紀錄'">
      <template #body>
        <div class="space-y-4">
          <UFormField label="器材" required>
            <USelect v-model="rentalForm.equipmentId" :items="equipItems" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="借用人" required>
              <UInput v-model="rentalForm.borrower" class="w-full" />
            </UFormField>
            <UFormField label="數量">
              <UInput v-model.number="rentalForm.qty" type="number" min="1" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="借出日">
              <UInput v-model="rentalForm.borrowDate" type="date" class="w-full" />
            </UFormField>
            <UFormField label="預計歸還日">
              <UInput v-model="rentalForm.dueDate" type="date" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="備註">
            <UTextarea v-model="rentalForm.note" class="w-full" :rows="2" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="rentalOpen = false">取消</UButton>
            <UButton :loading="rentalSaving" @click="saveRental">儲存</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
