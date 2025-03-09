import { Hono } from 'hono'
import { getDataSource } from '../db/connection'
import { TableMetadata, getAllTablesMetadata } from '../db/metadata'

// 存储当前的表元数据
let currentTables: TableMetadata[] | null = null

/**
 * 为数据库中的每个表生成 RESTful API
 * @param app Hono 应用实例
 */
export async function generateRestApi(app: Hono): Promise<void> {
  // 获取表元数据
  currentTables = await getAllTablesMetadata()
  console.log(`已为 ${currentTables.length} 个表生成 RESTful API`)
}

/**
 * 创建动态路由中间件
 */
export function createDynamicRouteMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    const path = c.req.path
    const method = c.req.method

    // 如果不是 API 请求，继续下一个中间件
    if (
      !path.startsWith('/api/') ||
      path === '/api/config' ||
      path === '/api/connect' ||
      path === '/api/query'
    ) {
      return next()
    }

    // 检查是否已初始化
    if (!currentTables) {
      return c.json({ success: false, error: '数据库 API 未初始化' }, 503)
    }

    const dataSource = getDataSource()
    const segments = path.split('/').filter(Boolean)

    // 处理 /api/metadata 请求
    if (segments.length === 2 && segments[1] === 'metadata') {
      return c.json({ success: true, data: currentTables })
    }

    // 确保路径格式正确
    if (segments.length < 2 || segments.length > 3) {
      return next()
    }

    const tableName = segments[1]
    const id = segments[2]

    // 检查表是否存在
    const table = currentTables.find(t => t.name.toLowerCase() === tableName.toLowerCase())
    if (!table) {
      return c.json({ success: false, error: `表 ${tableName} 不存在` }, 404)
    }

    // 获取主键
    const primaryKey = table.columns.find(col => col.isPrimary)?.name || 'id'

    try {
      switch (method) {
        case 'GET':
          if (id) {
            // 获取单个记录
            const result = await dataSource.query(
              `SELECT * FROM "${tableName}" WHERE ${primaryKey} = ?`,
              [id],
            )

            if (result.length === 0) {
              return c.json({ success: false, error: '记录不存在' }, 404)
            }

            return c.json({ success: true, data: result[0] })
          } else {
            // 获取所有记录
            const result = await dataSource.query(`SELECT * FROM "${tableName}"`)
            return c.json({ success: true, data: result })
          }

        case 'POST':
          if (id) {
            return c.json({ success: false, error: '创建记录时不需要指定 ID' }, 400)
          }

          // 创建记录
          const body = await c.req.json()
          const columns = Object.keys(body).filter(key =>
            table.columns.some(col => col.name === key),
          )

          if (columns.length === 0) {
            return c.json({ success: false, error: '没有提供有效的字段' }, 400)
          }

          const placeholders = columns.map(() => '?').join(', ')
          const values = columns.map(col => body[col])

          const query = `
            INSERT INTO "${tableName}" (${columns.join(', ')})
            VALUES (${placeholders})
          `

          const result = await dataSource.query(query, values)

          return c.json(
            {
              success: true,
              message: '记录创建成功',
              id: result.lastID,
            },
            201,
          )

        case 'PUT':
          if (!id) {
            return c.json({ success: false, error: '更新记录时需要指定 ID' }, 400)
          }

          // 更新记录
          const updateBody = await c.req.json()
          const updateColumns = Object.keys(updateBody).filter(key =>
            table.columns.some(col => col.name === key),
          )

          if (updateColumns.length === 0) {
            return c.json({ success: false, error: '没有提供有效的字段' }, 400)
          }

          const setClause = updateColumns.map(col => `${col} = ?`).join(', ')
          const updateValues = [...updateColumns.map(col => updateBody[col]), id]

          const updateQuery = `
            UPDATE "${tableName}"
            SET ${setClause}
            WHERE ${primaryKey} = ?
          `

          const updateResult = await dataSource.query(updateQuery, updateValues)

          if (updateResult.changes === 0) {
            return c.json({ success: false, error: '记录不存在或未更改' }, 404)
          }

          return c.json({
            success: true,
            message: '记录更新成功',
          })

        case 'DELETE':
          if (!id) {
            return c.json({ success: false, error: '删除记录时需要指定 ID' }, 400)
          }

          // 删除记录
          const deleteResult = await dataSource.query(
            `DELETE FROM "${tableName}" WHERE ${primaryKey} = ?`,
            [id],
          )

          if (deleteResult.changes === 0) {
            return c.json({ success: false, error: '记录不存在' }, 404)
          }

          return c.json({
            success: true,
            message: '记录删除成功',
          })

        default:
          return next()
      }
    } catch (error) {
      console.error(`处理 ${method} ${path} 请求失败:`, error)
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        },
        500,
      )
    }
  }
}
