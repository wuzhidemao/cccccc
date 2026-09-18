// 内置示例题解（Markdown 字符串）
// 每篇题解顶部使用 --- 包裹的元信息块：title / difficulty / tags
window.SAMPLE_SOLUTIONS = [
  {
    id: "two-sum",
    content: `---
title: 两数之和
difficulty: easy
tags: [数组, 哈希表]
---

# 两数之和

## 题目描述

给定一个整数数组 \`nums\` 和一个整数目标值 \`target\`，请你在该数组中找出 **和为目标值** \`target\` 的那两个整数，并返回它们的数组下标。

你可以假设每种输入只会对应一个答案，并且你不能使用两次相同的元素。

## 示例

\`\`\`
输入：nums = [2,7,11,15], target = 9
输出：[0,1]
解释：因为 nums[0] + nums[1] == 9 ，返回 [0, 1] 。
\`\`\`

## 解题思路

### 方法一：暴力枚举

两层循环遍历所有数对，时间复杂度 $O(n^2)$，空间复杂度 $O(1)$。

### 方法二：哈希表（推荐）

遍历数组时，用哈希表记录已访问数字及其下标。对于当前元素 \`x\`，检查 \`target - x\` 是否在哈希表中：
- 若存在，直接返回两个下标；
- 若不存在，将当前元素存入哈希表。

时间复杂度 $O(n)$，空间复杂度 $O(n)$。

## 代码实现

\`\`\`cpp
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> mp;
        for (int i = 0; i < nums.size(); ++i) {
            int need = target - nums[i];
            if (mp.count(need)) {
                return {mp[need], i};
            }
            mp[nums[i]] = i;
        }
        return {};
    }
};
\`\`\`

## 复杂度分析

| 方法 | 时间复杂度 | 空间复杂度 |
|------|-----------|-----------|
| 暴力枚举 | $O(n^2)$ | $O(1)$ |
| 哈希表 | $O(n)$ | $O(n)$ |

> 哈希表是解决「查找类」问题的利器，把线性查找降到常数级。
`
  },
  {
    id: "longest-substring",
    content: `---
title: 无重复字符的最长子串
difficulty: medium
tags: [字符串, 滑动窗口, 哈希表]
---

# 无重复字符的最长子串

## 题目描述

给定一个字符串 \`s\`，请你找出其中不含有重复字符的 **最长子串** 的长度。

## 示例

\`\`\`
输入: s = "abcabcbb"
输出: 3
解释: 因为无重复字符的最长子串是 "abc"，所以其长度为 3。
\`\`\`

## 解题思路

使用**滑动窗口**思想：维护一个窗口 \`[left, right]\`，保证窗口内字符不重复。

1. 用哈希表记录每个字符最后出现的位置；
2. 右指针 \`right\` 不断右移扩展窗口；
3. 若当前字符已在窗口内出现，则将左指针 \`left\` 移动到重复字符的下一位；
4. 过程中更新最大窗口长度。

## 代码实现

\`\`\`cpp
class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        unordered_map<char, int> last;
        int ans = 0, left = 0;
        for (int right = 0; right < s.size(); ++right) {
            char c = s[right];
            if (last.count(c) && last[c] >= left) {
                left = last[c] + 1;
            }
            last[c] = right;
            ans = max(ans, right - left + 1);
        }
        return ans;
    }
};
\`\`\`

## 复杂度分析

- **时间复杂度**：$O(n)$，每个字符最多被访问两次。
- **空间复杂度**：$O(\\Sigma)$，$\\Sigma$ 为字符集大小。

## 扩展思考

如果字符集为 ASCII，可以用 \`int[128]\` 代替 \`unordered_map\`，常数更小。
`
  },
  {
    id: "merge-k-sorted",
    content: `---
title: 合并 K 个升序链表
difficulty: hard
tags: [链表, 堆, 分治]
---

# 合并 K 个升序链表

## 题目描述

给你一个链表数组，每个链表都已经按升序排列。请你将所有链表合并到一个升序链表中，返回合并后的链表。

## 示例

\`\`\`
输入：lists = [[1,4,5],[1,3,4],[2,6]]
输出：[1,1,2,3,4,4,5,6]
\`\`\`

## 解题思路

### 方法一：小顶堆

维护一个大小为 $k$ 的小顶堆，每次取出堆顶节点加入结果，并将该节点的 \`next\` 入堆。

### 方法二：分治合并

类似归并排序，两两合并链表，时间复杂度更优。

## 代码实现（小顶堆）

\`\`\`cpp
class Solution {
public:
    ListNode* mergeKLists(vector<ListNode*>& lists) {
        auto cmp = [](ListNode* a, ListNode* b) {
            return a->val > b->val;
        };
        priority_queue<ListNode*, vector<ListNode*>, decltype(cmp)> pq(cmp);

        for (auto node : lists) {
            if (node) pq.push(node);
        }

        ListNode dummy(0), *tail = &dummy;
        while (!pq.empty()) {
            ListNode* cur = pq.top(); pq.pop();
            tail->next = cur;
            tail = cur;
            if (cur->next) pq.push(cur->next);
        }
        return dummy.next;
    }
};
\`\`\`

## 复杂度分析

- **时间复杂度**：$O(N \\log k)$，$N$ 为节点总数，$k$ 为链表数。
- **空间复杂度**：$O(k)$，堆的大小。

> 当 $k$ 较大时，分治法的常数因子更小，实际运行更快。
`
  },
  {
    id: "binary-tree-level-order",
    content: `---
title: 二叉树的层序遍历
difficulty: medium
tags: [树, 广度优先搜索, 队列]
---

# 二叉树的层序遍历

## 题目描述

给你二叉树的根节点 \`root\`，返回其节点值的 **层序遍历**（即逐层地，从左到右访问所有节点）。

## 解题思路

使用**队列**实现 BFS。每一轮处理当前层的所有节点，记录节点值，并将子节点入队。

关键技巧：在每一层开始时记录队列长度，即可确定当前层有多少节点。

## 代码实现

\`\`\`cpp
class Solution {
public:
    vector<vector<int>> levelOrder(TreeNode* root) {
        vector<vector<int>> ans;
        if (!root) return ans;

        queue<TreeNode*> q;
        q.push(root);

        while (!q.empty()) {
            int size = q.size();
            vector<int> level;
            for (int i = 0; i < size; ++i) {
                TreeNode* node = q.front(); q.pop();
                level.push_back(node->val);
                if (node->left)  q.push(node->left);
                if (node->right) q.push(node->right);
            }
            ans.push_back(level);
        }
        return ans;
    }
};
\`\`\`

## 复杂度分析

- **时间复杂度**：$O(n)$，每个节点访问一次。
- **空间复杂度**：$O(n)$，队列最多存储一层节点。

## 相关题目

- 二叉树的锯齿形层序遍历
- 二叉树的最大深度
- N 叉树的层序遍历
`
  },
  {
    id: "knapsack-01",
    content: `---
title: 0-1 背包问题
difficulty: medium
tags: [动态规划, 背包]
---

# 0-1 背包问题

## 问题描述

有 $n$ 件物品和一个容量为 $W$ 的背包。第 $i$ 件物品的重量为 $w_i$，价值为 $v_i$。每件物品只能选一次，求背包能装下的最大价值。

## 状态定义

\`dp[i][j]\` 表示前 $i$ 件物品放入容量为 $j$ 的背包能获得的最大价值。

## 状态转移

$$dp[i][j] = \\max(dp[i-1][j],\\ dp[i-1][j-w_i] + v_i)$$

- 不选第 $i$ 件：\`dp[i-1][j]\`
- 选第 $i$ 件：\`dp[i-1][j-w_i] + v_i\`（需 $j \\geq w_i$）

## 空间优化

观察到第 $i$ 行只依赖第 $i-1$ 行，可使用一维数组并**倒序遍历**容量：

\`\`\`cpp
int knapsack(int W, vector<int>& w, vector<int>& v) {
    int n = w.size();
    vector<int> dp(W + 1, 0);
    for (int i = 0; i < n; ++i) {
        for (int j = W; j >= w[i]; --j) {
            dp[j] = max(dp[j], dp[j - w[i]] + v[i]);
        }
    }
    return dp[W];
}
\`\`\`

> 倒序遍历是为了保证每件物品只被使用一次。

## 复杂度

| 维度 | 二维 DP | 一维优化 |
|------|---------|---------|
| 时间 | $O(nW)$ | $O(nW)$ |
| 空间 | $O(nW)$ | $O(W)$ |
`
  },
  {
    id: "trie-implementation",
    content: `---
title: 实现 Trie（前缀树）
difficulty: medium
tags: [字典树, 字符串, 设计]
---

# 实现 Trie（前缀树）

## 题目描述

Trie（前缀树）是一种树形数据结构，用于高效地存储和检索字符串数据集中的键。请你实现 Trie 类：

- \`Trie()\` 初始化前缀树对象
- \`void insert(string word)\` 向前缀树中插入字符串 \`word\`
- \`boolean search(string word)\` 如果字符串 \`word\` 在前缀树中，返回 \`true\`
- \`boolean startsWith(string prefix)\` 如果之前已经插入的字符串 \`word\` 的前缀之一为 \`prefix\`，返回 \`true\`

## 数据结构

每个节点包含 26 个子节点指针和一个标记是否为单词结尾的 \`isEnd\`。

## 代码实现

\`\`\`cpp
class Trie {
private:
    struct TrieNode {
        TrieNode* children[26] = {nullptr};
        bool isEnd = false;
    };
    TrieNode* root;

public:
    Trie() : root(new TrieNode()) {}

    void insert(string word) {
        TrieNode* node = root;
        for (char c : word) {
            int idx = c - 'a';
            if (!node->children[idx]) {
                node->children[idx] = new TrieNode();
            }
            node = node->children[idx];
        }
        node->isEnd = true;
    }

    bool search(string word) {
        TrieNode* node = find(word);
        return node && node->isEnd;
    }

    bool startsWith(string prefix) {
        return find(prefix) != nullptr;
    }

private:
    TrieNode* find(const string& s) {
        TrieNode* node = root;
        for (char c : s) {
            int idx = c - 'a';
            if (!node->children[idx]) return nullptr;
            node = node->children[idx];
        }
        return node;
    }
};
\`\`\`

## 复杂度分析

- **插入/查询时间**：$O(L)$，$L$ 为字符串长度。
- **空间**：$O(\\Sigma \\cdot L \\cdot N)$。

## 应用场景

- 自动补全
- 拼写检查
- IP 路由最长前缀匹配
`
  },
  {
    id: "dijkstra",
    content: `---
title: Dijkstra 最短路径
difficulty: medium
tags: [图论, 最短路径, 堆]
---

# Dijkstra 单源最短路径

## 算法思想

Dijkstra 算法用于求解**非负权图**上单源最短路径问题。核心是贪心 + 优先队列：

1. 初始化源点距离为 0，其余为无穷大；
2. 每次取出未访问节点中距离最小的节点 $u$；
3. 用 $u$ 松弛其所有邻边；
4. 重复直到所有节点被访问。

## 代码实现（堆优化）

\`\`\`cpp
struct Edge { int to, w; };
using PII = pair<int, int>; // (距离, 节点)

vector<int> dijkstra(int n, int src, vector<vector<Edge>>& adj) {
    vector<int> dist(n + 1, INT_MAX);
    priority_queue<PII, vector<PII>, greater<PII>> pq;

    dist[src] = 0;
    pq.push({0, src});

    while (!pq.empty()) {
        auto [d, u] = pq.top(); pq.pop();
        if (d > dist[u]) continue; // 过期记录
        for (auto& e : adj[u]) {
            if (dist[u] + e.w < dist[e.to]) {
                dist[e.to] = dist[u] + e.w;
                pq.push({dist[e.to], e.to});
            }
        }
    }
    return dist;
}
\`\`\`

## 复杂度分析

- **时间复杂度**：$O((V+E) \\log V)$。
- **空间复杂度**：$O(V+E)$。

> 注意：Dijkstra 不能处理负权边，负权图请使用 Bellman-Ford 或 SPFA。
`
  },
  {
    id: "quick-sort",
    content: `---
title: 快速排序
difficulty: easy
tags: [排序, 分治, 双指针]
---

# 快速排序

## 算法思想

快速排序采用**分治**策略：

1. **选取基准**：从数组中选一个元素 \`pivot\`；
2. **分区**：将小于 pivot 的放左边，大于的放右边；
3. **递归**：对左右子数组递归排序。

## 代码实现

\`\`\`cpp
class QuickSort {
public:
    void sort(vector<int>& nums) {
        quickSort(nums, 0, nums.size() - 1);
    }

private:
    void quickSort(vector<int>& nums, int left, int right) {
        if (left >= right) return;
        int pivot = partition(nums, left, right);
        quickSort(nums, left, pivot - 1);
        quickSort(nums, pivot + 1, right);
    }

    int partition(vector<int>& nums, int left, int right) {
        int pivot = nums[right]; // 取最右为基准
        int i = left - 1;
        for (int j = left; j < right; ++j) {
            if (nums[j] <= pivot) {
                swap(nums[++i], nums[j]);
            }
        }
        swap(nums[i + 1], nums[right]);
        return i + 1;
    }
};
\`\`\`

## 复杂度分析

| 情况 | 时间复杂度 |
|------|-----------|
| 最好 | $O(n \\log n)$ |
| 平均 | $O(n \\log n)$ |
| 最坏 | $O(n^2)$（已排序 + 固定基准） |

- **空间复杂度**：$O(\\log n)$（递归栈）。

## 优化技巧

1. **随机基准**：避免最坏情况；
2. **三数取中**：选首、中、尾的中位数；
3. **小区间插入排序**：递归深度大时切换。
`
  }
];
