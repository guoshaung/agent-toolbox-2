import type { Paper, Workspace } from '../shared/types';
const paper = (
  id: string,
  title: string,
  year: number,
  authors: string[],
  topics: string[],
): Paper => ({
  id: `arxiv:${id}`,
  title,
  year,
  date: `${year}-01-01`,
  authors,
  topics,
  venue: 'arXiv',
  doi: `10.48550/arXiv.${id}`,
  url: `https://arxiv.org/abs/${id}`,
  abstract:
    '这是一份用于体验工作区的示例文献。点击“打开原文”查看论文，或联网检索获取当前的题录、摘要和引用信息。',
  cited: 0,
  references: [],
  openAccess: true,
  source: '示例文献',
});
export const samplePapers: Paper[] = [
  paper(
    '2410.05779',
    'LightRAG: Simple and Fast Retrieval-Augmented Generation',
    2024,
    ['Zirui Guo', 'Lianghao Xia', 'Yanhua Yu', 'Chao Huang'],
    ['知识图谱', 'RAG', '检索增强'],
  ),
  paper(
    '2404.16130',
    'From Local to Global: A Graph RAG Approach to Query-Focused Summarization',
    2024,
    ['Darren Edge', 'Ha Trinh', 'Newman Cheng'],
    ['知识图谱', 'RAG', '摘要生成'],
  ),
  paper(
    '2401.18059',
    'RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval',
    2024,
    ['Parth Sarthi', 'Salman Abdullah', 'Aditi Tuli'],
    ['层次检索', 'RAG', '长文本'],
  ),
  paper(
    '2401.15884',
    'Corrective Retrieval Augmented Generation',
    2024,
    ['Shi-Qi Yan', 'Jia-Chen Gu', 'Yun Zhu', 'Zhen-Hua Ling'],
    ['检索评估', 'RAG', '自我修正'],
  ),
  paper(
    '2310.11511',
    'Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection',
    2023,
    ['Akari Asai', 'Zeqiu Wu', 'Yizhong Wang'],
    ['自我修正', 'RAG', '检索评估'],
  ),
  paper(
    '2307.03172',
    'Lost in the Middle: How Language Models Use Long Contexts',
    2023,
    ['Nelson F. Liu', 'Kevin Lin', 'John Hewitt'],
    ['长文本', '评测', '语言模型'],
  ),
  paper(
    '2005.11401',
    'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    2020,
    ['Patrick Lewis', 'Ethan Perez', 'Aleksandra Piktus'],
    ['RAG', '语言模型', '检索增强'],
  ),
  paper(
    '1706.03762',
    'Attention Is All You Need',
    2017,
    ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'],
    ['语言模型', 'Transformer', '基础方法'],
  ),
];
export function initialWorkspace(): Workspace {
  return {
    version: 1,
    libraries: [
      {
        id: 'rag',
        name: 'RAG 与知识检索',
        query: 'retrieval augmented generation',
        color: '#88a5ff',
        papers: samplePapers,
        updatedAt: null,
        demo: true,
      },
      {
        id: 'agents',
        name: '智能体与工具调用',
        query: 'language model agents tool use',
        color: '#66d9bd',
        papers: [],
        updatedAt: null,
        demo: false,
      },
      {
        id: 'science',
        name: 'AI × 科学发现',
        query: 'AI for scientific discovery',
        color: '#e5ba7b',
        papers: [],
        updatedAt: null,
        demo: false,
      },
    ],
    annotations: {},
    preferences: {
      theme: 'dark',
      view: 'table',
      detailWidth: 340,
      detailOpen: true,
      activeLibrary: 'rag',
    },
  };
}
