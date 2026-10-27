import { parseText, sourceFor } from "./document";
import type {
  Gap,
  Requirement,
  Decision,
  ParsedDoc,
  TaskNode,
  Granularity,
} from "@/types";

export const SAMPLE_TEXT = `# 校园二手交易平台 V2.0

产品需求文档 · 2026 年 10 月 · 校园创新实验室

## 01 项目概述

为在校学生提供闲置物品流转渠道，减少资源浪费。本文为待评审草案，部分约束尚未确认。

## 02 用户与准入

R-01 账号认证：仅限本校学生认证后使用。对接学校统一身份认证系统，认证后展示昵称与院系。

## 03 商品与交易

R-02 商品发布：卖家填写商品名称、价格、描述和分类，可上传商品图片。

R-03 商品搜索：买家可按关键词搜索，按价格区间与商品分类筛选，结果按发布时间降序排列。

R-04 交易订单：用户支付成功后，系统创建订单并通知卖家。订单包含商品、买卖双方和成交价格。

R-05 商品详情：展示标题、图片、价格、描述与卖家院系，已下架的商品展示下架提示，不可下单。

R-06 商品收藏：认证用户可收藏或取消收藏，在个人页查看收藏列表，重复收藏不得产生重复记录。

## 04 交流与管理

R-07 站内通知：支持站内消息通知。

R-08 交易评价：订单完成后，买家可提交 1 至 5 星评分和不超过 200 字的评价，提交后不可修改。

R-09 内容治理：违规商品由管理员下架。

## 05 运营补充

R-10 访问范围：支持外校用户浏览并下单。

R-11 过期清理：平台会定期清理过期商品，并给卖家发送过期提醒。

R-12 性能体验：保证首页加载流畅。

## 06 已确认决策

D-01 经讨论决定：本期不做在线支付，只做线下交易。理由：支付资质和退款处理成本高，团队资源有限。

D-02 确定采用响应式 Web 应用，不开发原生 App。理由：方便学生通过链接直接访问，降低推广成本。

D-03 暂不做信用评分体系。理由：交易数据量不足，避免不可靠评分影响学生权益。

D-04 确定商品有效期为 30 天，到期自动下架。理由：避免长期失效的商品挤占列表。

## 07 待讨论

建议后续考虑智能推荐；是否上线、何时上线均待定。这不是本期需求或已经作出的决策。`;

export const CONFLICT_TEXT = `# 校园二手交易平台 V2.1 补充决策

经讨论决定：本期新增信用评分体系，对全部买卖双方展示信用分，并将分数用于交易准入。理由：减少违约交易，提升交易信任。`;
export const sampleDoc = () =>
  parseText(SAMPLE_TEXT, "校园二手交易平台-V2.0.md");
export const isSample = (doc: ParsedDoc) => doc.text === SAMPLE_TEXT;

const requirementNames = [
  "校园身份认证",
  "商品发布与图片上传",
  "商品搜索与筛选",
  "交易与订单创建",
  "商品详情与下架状态",
  "商品收藏",
  "站内消息通知",
  "交易评价",
  "违规商品治理",
  "外校用户访问",
  "过期商品清理",
  "首页性能",
];
export function sampleRequirements(doc: ParsedDoc): Requirement[] {
  return doc.paragraphs
    .filter((p) => /^R-\d/.test(p.text))
    .map((p, i) => ({
      id: `R-${String(i + 1).padStart(2, "0")}`,
      title: requirementNames[i],
      summary: p.text.replace(/^R-\d+\s*/, ""),
      category: i === 11 ? "nonfunctional" : "functional",
      actors: [i === 8 ? "管理员" : "学生用户"],
      source: [sourceFor(doc, p)],
      completeness: [0, 1, 3, 0, 3, 3, 0, 3, 1, 0, 1, 0][i],
    }));
}

type GoldGap = {
  requirement: number;
  secondary?: number | string;
  category: Gap["category"];
  severity: Gap["severity"];
  title: string;
  question: string;
  why: string;
  suggestions: string[];
};
export const GOLD_GAPS: GoldGap[] = [
  {
    requirement: 4,
    category: "exception_flow",
    severity: "blocking",
    title: "支付成功，订单却没创建怎么办？",
    question: "支付成功后如果建单失败或通知中断，应如何补偿并避免重复扣款？",
    why: "资金动作与订单写入不是同一个事务；缺少补偿路径会造成用户已付款却没有订单。",
    suggestions: [
      "确认本期仅线下交易，移除线上支付流程。",
      "保留线上支付：按支付流水幂等建单，失败自动退款并通知用户。",
    ],
  },
  {
    requirement: 2,
    category: "boundary",
    severity: "major",
    title: "商品图片缺少数量与大小限制",
    question: "每个商品最多上传几张图片？单张大小和允许格式是什么？",
    why: "前端校验、存储容量和上传失败处理均依赖边界条件。",
    suggestions: [
      "最多 9 张，每张 ≤ 5 MB，支持 JPG、PNG、WebP。",
      "最多 5 张，每张 ≤ 2 MB，支持 JPG、PNG。",
    ],
  },
  {
    requirement: 12,
    category: "nonfunctional",
    severity: "major",
    title: "“加载流畅”无法量化验收",
    question: "在什么网络、设备与并发规模下，首屏时间需要达到多少？",
    why: "缺少可测量的性能预算，开发和评审无法判断是否达标。",
    suggestions: [
      "4G 网络下首屏 LCP ≤ 2.5 秒，支持 200 人同时在线。",
      "校园 Wi-Fi 下首页可交互时间 ≤ 2 秒，支持 500 人同时在线。",
    ],
  },
  {
    requirement: 7,
    category: "acceptance",
    severity: "major",
    title: "站内通知没有定义触发与送达标准",
    question: "哪些事件触发通知？发送失败是否重试，多久算送达？",
    why: "只有功能名称，缺少触发、观测和失败条件，无法编写验收用例。",
    suggestions: [
      "下单、完成交易、商品下架时触发；10 秒内送达，失败重试 3 次。",
      "下单和收到评价时触发；30 秒内送达，失败记录并支持手动重发。",
    ],
  },
  {
    requirement: 11,
    category: "ambiguity",
    severity: "minor",
    title: "“定期清理”的执行时点不明确",
    question: "清理任务多长时间执行一次，使用哪个时区，过期提醒提前多久发送？",
    why: "有效期虽已确认，但定期检查和提醒时机仍无法落实。",
    suggestions: [
      "每天北京时间 02:00 清理，提前 24 小时提醒。",
      "每小时整点检查，提前 48 小时提醒。",
    ],
  },
  {
    requirement: 1,
    secondary: 10,
    category: "conflict",
    severity: "blocking",
    title: "仅本校使用与外校可下单互相冲突",
    question: "以仅本校认证用户交易为准，还是允许外校用户下单？",
    why: "两处约束直接影响身份认证、访问控制和交易权限。",
    suggestions: [
      "本期仅本校认证学生可下单，外校只允许浏览。",
      "允许外校用户注册，但须额外完成学校与实名验证。",
    ],
  },
  {
    requirement: 1,
    category: "dependency",
    severity: "blocking",
    title: "学校统一认证接口尚未确认",
    question: "认证接口由谁提供？是否获准接入，接口文档与可用时间是什么？",
    why: "外部认证不可用会阻断注册与全部交易流程。",
    suggestions: [
      "校信息中心提供 OAuth2 接口，开工前确认测试账号与接口文档。",
      "校赛先使用测试认证适配器，明确标注非真实校方认证。",
    ],
  },
  {
    requirement: 9,
    category: "exception_flow",
    severity: "major",
    title: "违规下架缺少申诉与误判恢复流程",
    question: "如何判定违规？卖家怎样申诉，管理员误判后能否恢复？",
    why: "单向下架流程无法纠正误判，也没有可追踪的治理依据。",
    suggestions: [
      "记录违规规则与操作人，卖家 7 天内可申诉，管理员复核后恢复。",
      "建立二次审核，24 小时内处理申诉，保留全部操作记录。",
    ],
  },
  {
    requirement: 4,
    secondary: "D-01",
    category: "conflict",
    severity: "blocking",
    title: "在线付款流程与线下交易决策冲突",
    question: "交易需求中的“支付成功”是否应按已确认决策删除？",
    why: "需求要求线上付款，但已确认决策明确不做在线支付，无法同时实现。",
    suggestions: [
      "以 D-01 为准：改成买卖双方确认线下成交后创建交易记录。",
      "撤销 D-01：另行确认支付资质、预算和退款方案后实施。",
    ],
  },
];

export function sampleGaps(doc: ParsedDoc): Gap[] {
  const requirements = sampleRequirements(doc);
  return GOLD_GAPS.map((g, i) => {
    const { requirement, secondary, ...data } = g;
    const source = [...requirements[requirement - 1].source];
    if (typeof secondary === "number")
      source.push(...requirements[secondary - 1].source);
    if (typeof secondary === "string")
      source.push(
        sourceFor(
          doc,
          doc.paragraphs.find((p) => p.text.startsWith(secondary))!,
        ),
      );
    return {
      ...data,
      id: `G-${String(i + 1).padStart(2, "0")}`,
      source,
      resolution: null,
    };
  });
}

export function sampleDecisions(doc: ParsedDoc): Decision[] {
  const topics = [
    "本期交易与支付方式",
    "产品形态",
    "信用评分体系",
    "商品有效期",
  ];
  const chosen = [
    "仅做线下交易",
    "响应式 Web 应用",
    "暂不做信用评分",
    "30 天后自动下架",
  ];
  return doc.paragraphs
    .filter((p) => /^D-\d/.test(p.text))
    .map((p, i) => ({
      id: `D-0${i + 1}`,
      topic: topics[i],
      selected: chosen[i],
      reason: p.text.split("理由：")[1],
      options: [],
      constraints: ["以本期范围为准"],
      scope: [topics[i]],
      participants: [],
      status: "confirmed",
      source: [sourceFor(doc, p)],
    }));
}

const sampleAC: Record<string, string[]> = {
  "R-01": [
    "[学校认证测试接口可用] 当已认证的本校账号完成登录回调时，系统建立会话，个人页显示与回调一致的昵称和院系。",
  ],
  "R-02": [
    "[卖家已登录且上传边界已确认] 当填写商品名称、价格、描述、分类并上传允许格式的图片时，系统保存商品，详情页逐项展示与提交内容一致的信息。",
    "[商品图片规则已配置] 当上传文件超过已确认数量或单张大小上限时，系统拒绝超限文件，页面显示对应限制且保留已填写内容。",
  ],
  "R-03": [
    "[存在不同价格和分类的样例商品] 当输入关键词并选定价格范围与分类时，系统返回同时满足三个条件的商品，列表按发布时间降序排列。",
  ],
  "R-04": [
    "[交易方式与失败补偿已确认] 当按确认的交易流程完成一次成交时，系统写入包含商品、买卖双方和价格的交易记录，双方可查询到同一记录编号。",
  ],
  "R-05": [
    "[商品已被管理员下架] 当用户打开该商品详情时，系统展示下架状态，页面不提供可提交的下单入口。",
  ],
  "R-06": [
    "[同一商品尚未收藏] 当认证用户连续两次点击收藏时，系统按最终收藏状态保存数据，个人收藏列表最多出现一条该商品记录。",
  ],
  "R-07": [
    "[通知触发事件、时限与重试次数已确认] 当发生一项约定事件时，系统向接收方创建站内通知，通知的商品编号与事件记录一致且在确认时限内可见。",
  ],
  "R-08": [
    "[订单已完成] 当买家提交 1 至 5 星及不超过 200 字的评价时，系统保存一次评价，刷新后评分与内容一致且没有修改入口。",
  ],
  "R-09": [
    "[违规规则、申诉与恢复机制已确认] 当管理员按规则下架违规商品时，系统保存商品编号、操作人和违规原因，商品不再出现在可购买列表中。",
  ],
  "R-10": [
    "[本校与外校权限范围已确认] 当使用外校测试账号访问并尝试下单时，系统按确认的权限拒绝或允许该操作，响应与页面展示的权限状态一致。",
  ],
  "R-11": [
    "[商品发布已满 30 天且清理时点已确认] 当清理任务执行时，系统将过期商品下架，列表不再显示该商品且生成一条卖家提醒记录。",
  ],
  "R-12": [
    "[设备、网络与性能阈值已确认] 当在约定环境下进行首页性能测试时，系统加载首屏内容，测试报告中的 LCP 与并发测量值均达到确认阈值。",
  ],
};

/** 确定性演示任务；粒度改变只影响 PLAN，不影响抽取与审查。 */
export function mockTasks(
  requirements: Requirement[],
  gaps: Gap[],
  granularity: Granularity,
): TaskNode[] {
  const groups =
    granularity === "brief"
      ? requirements.reduce<Requirement[][]>((acc, r, i) => {
          if (i % 5 === 1) acc.at(-1)!.push(r);
          else acc.push([r]);
          return acc;
        }, [])
      : requirements.map((r) => [r]);
  const tasks: TaskNode[] = [];
  for (const group of groups) {
    const count =
      granularity === "detailed"
        ? 3
        : granularity === "standard" && tasks.length % 3 === 0
          ? 2
          : 1;
    const baseIndex = tasks.length;
    for (let i = 0; i < count; i++) {
      const id = `T-${String(tasks.length + 1).padStart(2, "0")}`;
      const related = gaps.filter(
        (g) =>
          g.resolution &&
          g.source.some((s) =>
            group.some((r) =>
              r.source.some((rs) => rs.offset.start === s.offset.start),
            ),
          ),
      );
      const title = group.map((r) => r.title).join("与");
      const label =
        count === 1
          ? "实现"
          : i === 0
            ? "定义交互与数据契约："
            : i === 1
              ? "实现"
              : "验证";
      const mainSource = group.flatMap((r) => r.source);
      tasks.push({
        id,
        title: `${label}${title}`,
        description: `落实${group.map((r) => r.summary).join("；")}${related.length ? "\n已确认补充：" + related.map((g) => g.resolution!.answer).join("；") : ""}`,
        acceptanceCriteria: [
          ...group.flatMap((r) =>
            r.title.includes("占位")
              ? [
                  `[演示数据已加载] 当打开占位任务时，系统显示通用演示提示，页面明确标注尚未进行真实文档分析。`,
                ]
              : (sampleAC[r.id] ?? [
                  `[需求已确认] 当执行“${r.title}”时，系统保存对应结果，页面能够重新查询本次操作记录。`,
                ]),
          ),
          ...(related.length
            ? related.map(
                (g) =>
                  `[补充规则已生效] 当触发“${g.title}”涉及的场景时，系统执行“${g.resolution!.answer}”，结果可在页面或日志中核对。`,
              )
            : []),
        ],
        effort: i === 0 ? 1 : i === 1 ? 2 : 0.5,
        role:
          count > 1 && i === 0
            ? "pm"
            : i === 2
              ? "qa"
              : group.some((r) =>
                    ["R-01", "R-04", "R-07", "R-09", "R-11"].includes(r.id),
                  )
                ? "be"
                : "fe",
        deps:
          i > 0
            ? [`T-${String(baseIndex + i).padStart(2, "0")}`]
            : baseIndex > 0
              ? ["T-01"]
              : [],
        level: 0,
        source: mainSource,
        requirementIds: group.map((r) => r.id),
        derivedFromGap: related.map((g) => g.id),
        confidence: 0.91,
      });
    }
  }
  return tasks;
}
