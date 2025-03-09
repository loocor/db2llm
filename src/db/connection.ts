import fs from 'node:fs'
import { DataSource } from 'typeorm'
import { getConfig } from '../utils/config'

let dataSource: DataSource | null = null

/**
 * 连接到指定的 SQLite 数据库
 * @param dbPath SQLite 数据库文件路径
 * @returns 数据库连接实例
 */
export async function connectToDatabase(dbPath: string): Promise<DataSource> {
  // 检查文件是否存在
  if (!fs.existsSync(dbPath)) {
    throw new Error(`数据库文件不存在: ${dbPath}`)
  }

  // 关闭现有连接
  if (dataSource?.isInitialized) {
    await dataSource.destroy()
  }

  // 获取配置
  const config = getConfig()
  const dbConfig = config.database.connection

  // 创建新连接
  dataSource = new DataSource({
    type: 'sqlite',
    database: dbPath,
    synchronize: dbConfig.synchronize,
    logging: dbConfig.logging,
    entities: [],
  })

  // 初始化连接
  await dataSource.initialize()
  console.log(`已连接到数据库: ${dbPath}`)

  return dataSource
}

/**
 * 获取当前数据库连接
 * @returns 当前数据库连接实例
 */
export function getDataSource(): DataSource {
  if (!dataSource || !dataSource.isInitialized) {
    throw new Error('数据库未连接，请先调用 connectToDatabase')
  }
  return dataSource
}

/**
 * 关闭数据库连接
 */
export async function closeConnection(): Promise<void> {
  if (dataSource?.isInitialized) {
    await dataSource.destroy()
    dataSource = null
    console.log('数据库连接已关闭')
  }
}
