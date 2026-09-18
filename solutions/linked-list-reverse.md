---
title: 反转链表
difficulty: easy
tags: [链表, 递归, 迭代]
---

# 反转链表

## 题目描述

给你单链表的头节点 `head`，请你反转链表，并返回反转后的链表。

## 示例

```
输入：head = [1,2,3,4,5]
输出：[5,4,3,2,1]
```

## 解题思路

### 方法一：迭代

使用三个指针 `prev`、`curr`、`next` 逐个翻转节点的 next 指针。

### 方法二：递归

递归到链表末尾，然后逐层翻转指针。

## 代码实现（迭代）

```cpp
class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        ListNode* prev = nullptr;
        ListNode* curr = head;
        while (curr) {
            ListNode* next = curr->next;
            curr->next = prev;
            prev = curr;
            curr = next;
        }
        return prev;
    }
};
```

## 代码实现（递归）

```cpp
class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        if (!head || !head->next) return head;
        ListNode* newHead = reverseList(head->next);
        head->next->next = head;
        head->next = nullptr;
        return newHead;
    }
};
```

## 复杂度分析

| 方法 | 时间复杂度 | 空间复杂度 |
|------|-----------|-----------|
| 迭代 | $O(n)$ | $O(1)$ |
| 递归 | $O(n)$ | $O(n)$（递归栈） |
