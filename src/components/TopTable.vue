<script setup lang="ts">
import type { SongStats } from '../types'

interface Props {
  title: string
  data: SongStats[]
  valueKey: keyof SongStats
}

const props = defineProps<Props>()

const formatValue = (item: SongStats, key: keyof SongStats): string => {
  const value = item[key]
  if (typeof value === 'number') {
    return value.toFixed(2)
  }
  return String(value)
}
</script>

<template>
  <div class="table-section">
    <div class="section-header">
      <h2>{{ title }}</h2>
    </div>
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>曲名</th>
            <th>良</th>
            <th>可</th>
            <th>不可</th>
            <th>{{ title.split(' ')[0] }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in data" :key="index">
            <td>{{ index + 1 }}</td>
            <td>{{ item.title }}</td>
            <td>{{ item.great }}</td>
            <td>{{ item.good }}</td>
            <td>{{ item.bad }}</td>
            <td>{{ formatValue(item, valueKey) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.table-section {
  margin-top: 0;
  background: white;
  padding: 10px;
  border-radius: 8px;
}

.table-responsive {
  overflow-x: auto;
}

.section-header {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
}

.save-btn {
  padding: 6px 12px;
  background-color: #e91e63;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.save-btn:hover {
  background-color: #c2185b;
}

.save-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

h2 {
  color: #333;
  margin: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th, td {
  padding: 10px;
  border-bottom: 1px solid #ddd;
  text-align: left;
}

th {
  background-color: #e91e63;
  color: white;
}

tr:nth-child(even) {
  background-color: #f2f2f2;
}
</style>
