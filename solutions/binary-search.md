---
title: 二分查找
difficulty: easy
tags: [二分查找, 数组]
---

# 二分查找

## 题目描述

给定一个 n 个元素有序的（升序）整型数组 `nums` 和一个目标值 `target`，写一个函数搜索 `nums` 中的 `target`，如果目标值存在返回下标，否则返回 -1。

## 示例

```
输入: nums = [-1,0,3,5,9,12], target = 9
输出: 4
解释: 9 出现在 nums 中并且下标为 4
```

## 解题思路

二分查找的核心是**每次将搜索区间缩小一半**：

1. 初始化 `left = 0`，`right = n - 1`；
2. 计算中间位置 `mid = left + (right - left) / 2`；
3. 若 `nums[mid] == target`，返回 `mid`；
4. 若 `nums[mid] < target`，说明目标在右半区，`left = mid + 1`；
5. 否则 `right = mid - 1`；
6. 循环直到 `left > right`，返回 -1。

> 注意：使用 `left + (right - left) / 2` 而非 `(left + right) / 2`，避免整数溢出。

## 代码实现

```cpp
class Solution {
public:
    int search(vector<int>& nums, int target) {
        int left = 0, right = nums.size() - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) left = mid + 1;
            else right = mid - 1;
        }
        return -1;
    }
};
```

## 复杂度分析

- **时间复杂度**：$O(\log n)$
- **空间复杂度**：$O(1)$

## 适用场景

- 有序数组的查找
- 查找第一个/最后一个满足条件的元素
- 答案具有单调性的问题（二分答案）
